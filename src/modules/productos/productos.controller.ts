import { Body, Controller, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TipoProducto } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ProductosService } from './productos.service';

@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  @RequierePermisos('productos:crear')
  @ApiOperation({ summary: 'Crear producto/servicio (IVA por categoría fiscal + override)' })
  crear(
    @Body() dto: CrearProductoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.productos.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Listar/buscar productos' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoProducto })
  @ApiQuery({ name: 'bajoStock', required: false, type: Boolean })
  listar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('tipo') tipo?: TipoProducto,
    @Query('bajoStock') bajoStock?: string,
  ) {
    return this.productos.listar(actor, { q, tipo, bajoStock: bajoStock === 'true' });
  }

  @Get(':id')
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Detalle de un producto' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.productos.obtener(id, actor);
  }

  @Patch(':id')
  @RequierePermisos('productos:editar')
  @ApiOperation({ summary: 'Actualizar un producto' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarProductoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.productos.actualizar(id, dto, actor, ip);
  }
}
