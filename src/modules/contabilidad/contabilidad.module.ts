import { Module } from '@nestjs/common';
import { ContabilidadController } from './contabilidad.controller';
import { ContabilidadService } from './contabilidad.service';
import { DeclaracionesService } from './declaraciones.service';
import { LibrosService } from './libros.service';

@Module({
  controllers: [ContabilidadController],
  providers: [ContabilidadService, LibrosService, DeclaracionesService],
  exports: [LibrosService], // el Dashboard reutiliza el resumen de IVA
})
export class ContabilidadModule {}
