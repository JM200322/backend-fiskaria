import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Listar compras' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.compras.listar(actor);
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
