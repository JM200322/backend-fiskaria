import { Module } from '@nestjs/common';
import { PuntosEmisionModule } from '../puntos-emision/puntos-emision.module';
import { FacturadorController } from './facturador.controller';
import { FacturadorService } from './facturador.service';

@Module({
  // PuntosEmisionModule exporta NumeracionService (correlativo).
  imports: [PuntosEmisionModule],
  controllers: [FacturadorController],
  providers: [FacturadorService],
})
export class FacturadorModule {}
