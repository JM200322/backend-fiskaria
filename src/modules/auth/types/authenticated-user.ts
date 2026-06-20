/**
 * Forma del usuario autenticado que viaja en `request.user`
 * tras validar el JWT. `permisos` viene como lista de strings `modulo:accion`.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  contribuyenteId: string | null; // null = administrador de Sirumatek (RN-125)
  passwordTemporal: boolean; // si true, el frontend debe forzar cambio (RN-014)
  roles: string[];
  permisos: string[];
}

/** Payload que se firma dentro de los tokens. */
export interface JwtPayload {
  sub: string; // id del usuario
  email: string;
  jti?: string; // id único del token (solo en refresh tokens)
}
