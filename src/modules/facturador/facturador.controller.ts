import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EstatusDocumento, TipoDocumento } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EmitirFacturaDto } from './dto/emitir-factura.dto';
import { EmitirGuiaDto } from './dto/emitir-guia.dto';
import { EmitirNotaDto } from './dto/emitir-nota.dto';
import { FacturadorService } from './facturador.service';

@ApiTags('facturador')
@ApiBearerAuth()
@Controller('documentos')
export class FacturadorController {
  constructor(private readonly facturador: FacturadorService) {}

  @Post('factura')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Emitir factura (numeración + imprenta + stock + auditoría)' })
  emitirFactura(
    @Body() dto: EmitirFacturaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.facturador.emitirFactura(dto, actor, ip);
  }

  @Post('nota-credito')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Emitir nota de crédito (referencia a factura, reingresa stock)' })
  emitirNotaCredito(
    @Body() dto: EmitirNotaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.facturador.emitirNotaCredito(dto, actor, ip);
  }

  @Post('nota-debito')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Emitir nota de débito (referencia a factura)' })
  emitirNotaDebito(
    @Body() dto: EmitirNotaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.facturador.emitirNotaDebito(dto, actor, ip);
  }

  @Post('guia-despacho')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Emitir guía de despacho (movimiento de mercancía, sin factura previa)' })
  emitirGuia(@Body() dto: EmitirGuiaDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.facturador.emitirGuiaDespacho(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('facturas:ver')
  @ApiOperation({ summary: 'Listar documentos fiscales' })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoDocumento })
  @ApiQuery({ name: 'estatus', required: false, enum: EstatusDocumento })
  listar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tipo') tipo?: TipoDocumento,
    @Query('estatus') estatus?: EstatusDocumento,
  ) {
    return this.facturador.listar(actor, { tipo, estatus });
  }

  @Get(':id')
  @RequierePermisos('facturas:ver')
  @ApiOperation({ summary: 'Detalle de un documento fiscal' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.facturador.obtener(id, actor);
  }

  @Post('reprocesar-no-enviados')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Reprocesar manualmente todos los documentos "No enviado"' })
  reprocesar() {
    return this.facturador.reprocesarNoEnviados();
  }

  @Post(':id/reintentar')
  @RequierePermisos('facturas:crear')
  @ApiOperation({ summary: 'Reintentar la transmisión de un documento "No enviado"' })
  reintentar(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.facturador.reintentar(id, actor, ip);
  }
}
