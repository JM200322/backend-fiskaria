import { Module } from '@nestjs/common';
import { PuntosEmisionModule } from '../puntos-emision/puntos-emision.module';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { RetencionesController } from './retenciones.controller';
import { RetencionesService } from './retenciones.service';
import { RetencionesRecibidasController } from './retenciones-recibidas.controller';
import { RetencionesRecibidasService } from './retenciones-recibidas.service';

@Module({
  imports: [PuntosEmisionModule], // NumeracionService para los comprobantes de retención
  controllers: [ComprasController, RetencionesController, RetencionesRecibidasController],
  providers: [ComprasService, RetencionesService, RetencionesRecibidasService],
})
export class ComprasModule {}
