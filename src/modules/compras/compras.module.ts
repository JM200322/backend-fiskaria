import { Module } from '@nestjs/common';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { PuntosEmisionModule } from '../puntos-emision/puntos-emision.module';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { RetencionesController } from './retenciones.controller';
import { RetencionesService } from './retenciones.service';
import { RetencionesRecibidasController } from './retenciones-recibidas.controller';
import { RetencionesRecibidasService } from './retenciones-recibidas.service';

@Module({
  // PuntosEmisionModule: NumeracionService (comprobantes de retención).
  // ContabilidadModule: ContabilidadService (asiento automático de compra).
  imports: [PuntosEmisionModule, ContabilidadModule],
  controllers: [ComprasController, RetencionesController, RetencionesRecibidasController],
  providers: [ComprasService, RetencionesService, RetencionesRecibidasService],
})
export class ComprasModule {}
