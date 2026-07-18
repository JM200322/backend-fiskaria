import { Module } from '@nestjs/common';
import { ComprasModule } from '../compras/compras.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { OpenFoodFactsService } from './open-food-facts.service';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  // ContabilidadModule: asiento automático al reponer stock.
  // ComprasModule: ComprasService.buscarLineaFactura (match factura↔producto, RN-134).
  imports: [ContabilidadModule, ComprasModule],
  controllers: [ProductosController, CategoriasController],
  providers: [ProductosService, CategoriasService, OpenFoodFactsService],
})
export class ProductosModule {}
