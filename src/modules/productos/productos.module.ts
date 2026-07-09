import { Module } from '@nestjs/common';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { OpenFoodFactsService } from './open-food-facts.service';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  imports: [ContabilidadModule], // ContabilidadService: asiento automático al reponer stock
  controllers: [ProductosController, CategoriasController],
  providers: [ProductosService, CategoriasService, OpenFoodFactsService],
})
export class ProductosModule {}
