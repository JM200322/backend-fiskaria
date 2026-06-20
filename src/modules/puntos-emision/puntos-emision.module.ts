import { Module } from '@nestjs/common';
import { NumeracionService } from './numeracion.service';
import { PuntosEmisionController } from './puntos-emision.controller';
import { PuntosEmisionService } from './puntos-emision.service';

@Module({
  controllers: [PuntosEmisionController],
  providers: [PuntosEmisionService, NumeracionService],
  // NumeracionService se exporta para que el Facturador lo use en su transacción.
  exports: [NumeracionService],
})
export class PuntosEmisionModule {}
