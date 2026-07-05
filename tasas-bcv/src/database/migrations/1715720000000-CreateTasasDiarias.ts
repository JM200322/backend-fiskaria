import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OBSOLETA. El micro ya no usa una tabla propia `DBO.tasas_diarias`: persiste en la
 * tabla `tasa_cache` de la base del backend, que crea y gestiona Prisma. Esta migración
 * se deja como no-op para no recrear el esquema/tabla DBO si algo dispara `db:setup`.
 */
export class CreateTasasDiarias1715720000000 implements MigrationInterface {
  name = 'CreateTasasDiarias1715720000000';

  public async up(): Promise<void> {
    // no-op: la tabla tasa_cache la administra Prisma (backend).
  }

  public async down(): Promise<void> {
    // no-op
  }
}
