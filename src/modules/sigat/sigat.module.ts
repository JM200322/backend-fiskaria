import { Module } from '@nestjs/common';
import { SigatController } from './sigat.controller';
import { SigatService } from './sigat.service';

/**
 * Integración con SIGAT (sistema municipal tributario). Capa anticorrupción:
 * aísla el contrato del API externo. Exporta el servicio por si Municipales
 * necesita consolidar datos locales con los reales de la alcaldía (RN-140).
 */
@Module({
  controllers: [SigatController],
  providers: [SigatService],
  exports: [SigatService],
})
export class SigatModule {}
