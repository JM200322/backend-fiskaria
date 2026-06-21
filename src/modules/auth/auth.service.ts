import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtPayload } from './types/authenticated-user';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Valida credenciales y emite el par de tokens. */
  async login(email: string, password: string, ip?: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    // Mismo mensaje para email inexistente o clave incorrecta (no filtrar info).
    if (!usuario || !usuario.activo || usuario.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, usuario.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      contribuyenteId: usuario.contribuyenteId,
      ip,
      accion: 'login',
      entidad: 'usuario',
      entidadId: usuario.id,
    });

    const tokens = await this.emitirTokens(usuario.id, usuario.email);
    // El frontend usa passwordTemporal para forzar el cambio al primer ingreso (RN-014).
    return { ...tokens, passwordTemporal: usuario.passwordTemporal };
  }

  /** Cambia la contraseña del usuario y limpia la marca de clave temporal (RN-014). */
  async cambiarPassword(usuarioId: string, actual: string, nueva: string, ip?: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no válido');
    }
    const ok = await bcrypt.compare(actual, usuario.passwordHash);
    if (!ok) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await bcrypt.hash(nueva, 10), passwordTemporal: false },
    });

    // Por seguridad, se revocan las sesiones existentes tras cambiar la clave.
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revocado: false },
      data: { revocado: true },
    });

    await this.auditoria.registrar({
      usuarioId,
      contribuyenteId: usuario.contribuyenteId,
      ip,
      accion: 'cambiar_password',
      entidad: 'usuario',
      entidadId: usuarioId,
    });

    return { mensaje: 'Contraseña actualizada' };
  }

  /** Rota el refresh token: valida el actual, lo revoca y emite uno nuevo. */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });

    // Token desconocido o vencido.
    if (!stored || stored.expiraEn < new Date()) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }

    // Detección de reuso: un token ya revocado que se vuelve a presentar
    // es señal de robo => se revocan TODAS las sesiones del usuario.
    if (stored.revocado) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: stored.usuarioId, revocado: false },
        data: { revocado: true },
      });
      throw new UnauthorizedException('Refresh token reutilizado: sesiones revocadas');
    }

    // Verificación de integridad contra el hash almacenado.
    const ok = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!ok) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revocado: true },
    });

    return this.emitirTokens(payload.sub, payload.email);
  }

  /**
   * Recuperación de acceso (RN-014): genera una clave temporal y obliga a cambiarla.
   * Responde siempre genérico (no revela si el email existe). Mientras no haya SMTP, en
   * entornos no productivos devuelve la clave temporal para poder probar el flujo.
   */
  async recuperar(email: string, ip?: string) {
    const generico = { mensaje: 'Si el correo existe, se enviaron instrucciones de recuperación' };
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo || usuario.deletedAt) {
      return generico;
    }

    const claveTemporal = 'Tmp-' + randomUUID().replace(/-/g, '').slice(0, 10);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: await bcrypt.hash(claveTemporal, 10), passwordTemporal: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: usuario.id, revocado: false },
      data: { revocado: true },
    });
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      contribuyenteId: usuario.contribuyenteId,
      ip,
      accion: 'recuperar_password',
      entidad: 'usuario',
      entidadId: usuario.id,
    });

    // TODO: enviar la clave por correo (SMTP) al email principal/alternativo (RN-014).
    if (this.config.get<string>('env') !== 'production') {
      return { ...generico, claveTemporal };
    }
    return generico;
  }

  /** Cierra sesión revocando los refresh tokens vigentes del usuario. */
  async logout(usuarioId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revocado: false },
      data: { revocado: true },
    });
    return { mensaje: 'Sesión cerrada' };
  }

  /** Genera access + refresh tokens y persiste el hash del refresh. */
  private async emitirTokens(usuarioId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: usuarioId, email },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    // jti único por refresh token: garantiza que cada token sea distinto
    // aunque se emitan en el mismo segundo, y permite rotación/revocación fiable.
    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshToken = await this.jwt.signAsync(
      { sub: usuarioId, email, jti } as JwtPayload,
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        jti,
        usuarioId,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiraEn: this.calcularExpiracion(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  /** Convierte "7d" / "15m" / "30s" a una fecha de expiración. */
  private calcularExpiracion(expr: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expr.trim());
    const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ahora = Date.now();
    if (!match) {
      return new Date(ahora + 7 * ms.d);
    }
    const [, valor, unidad] = match;
    return new Date(ahora + parseInt(valor, 10) * ms[unidad as keyof typeof ms]);
  }
}
