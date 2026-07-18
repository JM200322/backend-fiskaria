import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ComprasService } from './compras.service';
import { RegistrarCompraDto, RegistrarPagoProveedorDto } from './dto/registrar-compra.dto';

@ApiTags('compras')
@ApiBearerAuth()
@Controller('compras')
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Post()
  @RequierePermisos('compras:crear')
  @ApiOperation({ summary: 'Registrar una factura de compra (IVA crédito fiscal)' })
  registrar(
    @Body() dto: RegistrarCompraDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.compras.registrar(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('compras:ver')
  @ApiOperation({ summary: 'Listar compras (paginado, con rango de fechas)' })
  @ApiQuery({ name: 'desde', required: false, description: 'Fecha desde YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Fecha hasta YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máx. registros 1-200 (default 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Desplazamiento para paginar (default 0)' })
  listar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.compras.listar(actor, {
      desde,
      hasta,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
    });
  }

  @Get('kpis')
  @RequierePermisos('compras:ver')
  @ApiOperation({
    summary: 'KPIs agregados de compras (mes en curso, por pagar, top proveedores) — SUM/GROUP BY sobre todo el dataset del tenant, no solo la página cargada',
  })
  @ApiQuery({ name: 'topLimit', required: false, description: 'Cantidad de proveedores en el ranking (default 4)' })
  kpis(@CurrentUser() actor: AuthenticatedUser, @Query('topLimit') topLimit?: string) {
    return this.compras.kpis(actor, { topLimit: topLimit !== undefined ? Number(topLimit) : undefined });
  }

  @Get(':id')
  @RequierePermisos('compras:ver')
  @ApiOperation({ summary: 'Detalle de una compra (pagos y retenciones)' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.compras.obtener(id, actor);
  }

  @Post(':id/pagos')
  @RequierePermisos('compras:crear')
  @ApiOperation({ summary: 'Registrar un pago a proveedor asociado a la compra' })
  agregarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoProveedorDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.compras.agregarPago(id, dto, actor, ip);
  }
}
