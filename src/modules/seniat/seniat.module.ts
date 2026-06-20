import { Global, Module } from '@nestjs/common';
import { SeniatService } from './seniat.service';

/**
 * Módulo global del validador SENIAT: lo consumen Contribuyentes (alta) y,
 * más adelante, Terceros (validación de RIF de clientes/proveedores).
 */
@Global()
@Module({
  providers: [SeniatService],
  exports: [SeniatService],
})
export class SeniatModule {}
