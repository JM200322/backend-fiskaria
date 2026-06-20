import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Guard global de autorización (RBAC): verifica que el usuario posea
 * todos los permisos exigidos por @RequierePermisos() en el endpoint.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @RequierePermisos => basta con estar autenticado.
    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    const tiene = user?.permisos ?? [];

    const faltantes = requeridos.filter((p) => !tiene.includes(p));
    if (faltantes.length > 0) {
      throw new ForbiddenException(`Permisos insuficientes: faltan ${faltantes.join(', ')}`);
    }
    return true;
  }
}
