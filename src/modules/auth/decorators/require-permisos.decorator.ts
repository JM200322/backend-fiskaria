import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

/**
 * Exige uno o más permisos para acceder al endpoint.
 * Formato del permiso: `modulo:accion` (ej. 'facturas:anular').
 * El usuario debe poseer TODOS los permisos indicados.
 *
 * @example
 *   @RequierePermisos('facturas:anular')
 *   @Delete(':id')
 *   anular() { ... }
 */
export const RequierePermisos = (...permisos: string[]) => SetMetadata(PERMISOS_KEY, permisos);
