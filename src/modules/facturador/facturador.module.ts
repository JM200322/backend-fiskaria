import { Module } from '@nestjs/common';
import { PuntosEmisionModule } from '../puntos-emision/puntos-emision.module';
import { FacturadorController } from './facturador.controller';
import { FacturadorService } from './facturador.service';
import { ReprocesoService } from './reproceso.service';

@Module({
  // PuntosEmisionModule exporta NumeracionService (correlativo).
  imports: [PuntosEmisionModule],
  controllers: [FacturadorController],
  providers: [FacturadorService, ReprocesoService],
  exports: [FacturadorService], // Ventas convierte una venta confirmada en factura
})
export class FacturadorModule {}
