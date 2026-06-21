import { Global, Module } from '@nestjs/common';
import { ImprentaService } from './imprenta.service';

/**
 * Módulo global de la Imprenta Digital. Lo consume el Facturador (y a futuro
 * Compras para las retenciones). Aísla el contrato externo del resto del sistema.
 */
@Global()
@Module({
  providers: [ImprentaService],
  exports: [ImprentaService],
})
export class ImprentaModule {}
