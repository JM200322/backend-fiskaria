import { Module } from '@nestjs/common';
import { FacturadorModule } from '../facturador/facturador.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [FacturadorModule], // para convertir una venta confirmada en factura
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
