import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EstadoVenta } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ConvertirVentaDto } from './dto/convertir-venta.dto';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { VentasService } from './ventas.service';

@ApiTags('ventas')
@ApiBearerAuth()
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  @RequierePermisos('ventas:crear')
  @ApiOperation({ summary: 'Crear una cotización' })
  crear(@Body() dto: CrearVentaDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.ventas.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('ventas:ver')
  @ApiOperation({ summary: 'Listar ventas / cotizaciones' })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoVenta })
  listar(@CurrentUser() actor: AuthenticatedUser, @Query('estado') estado?: EstadoVenta) {
    return this.ventas.listar(actor, estado);
  }

  @Get(':id')
  @RequierePermisos('ventas:ver')
  @ApiOperation({ summary: 'Detalle de una venta' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.ventas.obtener(id, actor);
  }

  @Post(':id/confirmar')
  @RequierePermisos('ventas:crear')
  @ApiOperation({ summary: 'Confirmar una cotización' })
  confirmar(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.ventas.confirmar(id, actor, ip);
  }

  @Post(':id/anular')
  @RequierePermisos('ventas:anular')
  @ApiOperation({ summary: 'Anular una venta no facturada' })
  anular(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.ventas.anular(id, actor, ip);
  }

  @Post(':id/facturar')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Convertir una venta confirmada en factura' })
  facturar(
    @Param('id') id: string,
    @Body() dto: ConvertirVentaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.ventas.convertirEnFactura(id, dto, actor, ip);
  }
}
