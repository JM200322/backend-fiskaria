import { Module } from '@nestjs/common';
import { ContabilidadController } from './contabilidad.controller';
import { ContabilidadService } from './contabilidad.service';
import { LibrosService } from './libros.service';

@Module({
  controllers: [ContabilidadController],
  providers: [ContabilidadService, LibrosService],
  exports: [LibrosService, ContabilidadService], // Dashboard: resumen IVA. Facturador/Compras: asientos automáticos
})
export class ContabilidadModule {}
