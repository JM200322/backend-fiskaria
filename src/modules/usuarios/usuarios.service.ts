import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

const SELECT = {
  id: true,
  email: true,
  emailAlternativo: true,
  nombre: true,
  activo: true,
  passwordTemporal: true,
  contribuyenteId: true,
  ultimoAcceso: true,
  roles: { select: { rol: { select: { nombre: true } } } },
};

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Crea un usuario con contraseña temporal (RN-014). Devuelve la clave para comunicarla. */
  async crear(dto: CrearUsuarioDto, actor: AuthenticatedUser, ip?: string) {
    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new BadRequestException('Ya existe un usuario con ese email');

    const roles = await this.resolverRoles(dto.roles, actor);
    const passwordTemporal = this.generarClaveTemporal();

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        emailAlternativo: dto.emailAlternativo,
        contribuyenteId: actor.contribuyenteId, // mismo comercio del admin (null si Sirumatek)
        passwordHash: await bcrypt.hash(passwordTemporal, 10),
        passwordTemporal: true,
        roles: { create: roles.map((r) => ({ rolId: r.id })) },
      },
      select: SELECT,
    });

    await this.audit(actor, ip, 'crear_usuario', usuario.id, { email: dto.email });
    return { usuario, passwordTemporal };
  }

  listar(actor: AuthenticatedUser) {
    return this.prisma.usuario.findMany({
      where: { deletedAt: null, ...this.scope(actor) },
      select: SELECT,
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null, ...this.scope(actor) },
      select: SELECT,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, actor: AuthenticatedUser, ip?: string) {
    await this.obtener(id, actor); // valida scope/existencia

    const data: Record<string, unknown> = {
      nombre: dto.nombre,
      emailAlternativo: dto.emailAlternativo,
      activo: dto.activo,
    };

    if (dto.roles) {
      const roles = await this.resolverRoles(dto.roles, actor);
      await this.prisma.usuarioRol.deleteMany({ where: { usuarioId: id } });
      data.roles = { create: roles.map((r) => ({ rolId: r.id })) };
    }

    const usuario = await this.prisma.usuario.update({ where: { id }, data, select: SELECT });
    await this.audit(actor, ip, 'actualizar_usuario', id);
    return usuario;
  }

  /** Restablece la contraseña a una temporal (admin). Revoca sesiones. */
  async resetPassword(id: string, actor: AuthenticatedUser, ip?: string) {
    await this.obtener(id, actor);
    const passwordTemporal = this.generarClaveTemporal();
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(passwordTemporal, 10), passwordTemporal: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: id, revocado: false },
      data: { revocado: true },
    });
    await this.audit(actor, ip, 'reset_password_usuario', id);
    return { passwordTemporal };
  }

  /** Resuelve los roles por nombre y valida permisos de asignación. */
  private async resolverRoles(nombres: string[], actor: AuthenticatedUser) {
    // Un admin de comercio no puede asignar el rol de soporte "Sirumatek".
    if (actor.contribuyenteId && nombres.includes('Sirumatek')) {
      throw new ForbiddenException('No puede asignar el rol Sirumatek');
    }
    const roles = await this.prisma.rol.findMany({ where: { nombre: { in: nombres } } });
    if (roles.length !== new Set(nombres).size) {
      throw new BadRequestException('Uno o más roles no existen');
    }
    return roles;
  }

  /** Sirumatek (sin comercio) ve todos; un comercio solo sus usuarios. */
  private scope(actor: AuthenticatedUser) {
    return actor.contribuyenteId ? { contribuyenteId: actor.contribuyenteId } : {};
  }

  private generarClaveTemporal(): string {
    return 'Tmp-' + randomUUID().replace(/-/g, '').slice(0, 10);
  }

  private audit(
    actor: AuthenticatedUser,
    ip: string | undefined,
    accion: string,
    entidadId: string,
    detalle?: Record<string, unknown>,
  ) {
    return this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      ip,
      accion,
      entidad: 'usuario',
      entidadId,
      detalle: detalle as never,
    });
  }
}
