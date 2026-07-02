import { Module } from '@nestjs/common';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { PuntosEmisionModule } from '../puntos-emision/puntos-emision.module';
import { FacturadorController } from './facturador.controller';
import { FacturadorService } from './facturador.service';
import { ReprocesoService } from './reproceso.service';

@Module({
  // PuntosEmisionModule exporta NumeracionService (correlativo).
  // ContabilidadModule exporta ContabilidadService (asiento automático de venta).
  imports: [PuntosEmisionModule, ContabilidadModule],
  controllers: [FacturadorController],
  providers: [FacturadorService, ReprocesoService],
  exports: [FacturadorService], // Ventas convierte una venta confirmada en factura
})
export class FacturadorModule {}
