import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../types/authenticated-user';

/**
 * Estrategia JWT: valida el access token y carga el usuario con sus
 * roles y permisos (frescos desde la BD) en cada petición.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: { include: { permiso: true } },
              },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.activo || usuario.deletedAt) {
      throw new UnauthorizedException('Usuario no válido o inactivo');
    }

    const roles = usuario.roles.map((ur) => ur.rol.nombre);
    const permisos = [
      ...new Set(
        usuario.roles.flatMap((ur) =>
          ur.rol.permisos.map((rp) => `${rp.permiso.modulo}:${rp.permiso.accion}`),
        ),
      ),
    ];

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      contribuyenteId: usuario.contribuyenteId,
      passwordTemporal: usuario.passwordTemporal,
      roles,
      permisos,
    };
  }
}
