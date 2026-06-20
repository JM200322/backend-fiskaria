import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público (sin autenticación).
 * Por defecto TODOS los endpoints requieren JWT; usa @Public() para excluir.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
