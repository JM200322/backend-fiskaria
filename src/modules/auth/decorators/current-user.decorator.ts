import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Inyecta el usuario autenticado (o una de sus propiedades) en el controlador.
 *
 * @example
 *   me(@CurrentUser() user: AuthenticatedUser) { ... }
 *   miId(@CurrentUser('id') id: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
