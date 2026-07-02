import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContabilidadService } from './contabilidad.service';
import { DeclaracionesService } from './declaraciones.service';
import { LibrosService } from './libros.service';
import {
  ConfigCuentaDto,
  CrearAsientoDto,
  CrearCuentaDto,
  DeclararIvaDto,
} from './dto/contabilidad.dto';

@ApiTags('contabilidad')
@ApiBearerAuth()
@Controller()
export class ContabilidadController {
  constructor(
    private readonly contabilidad: ContabilidadService,
    private readonly libros: LibrosService,
    private readonly declaraciones: DeclaracionesService,
  ) {}

  // Plan de cuentas
  @Post('plan-cuentas')
  @RequierePermisos('contabilidad:crear')
  @ApiOperation({ summary: 'Crear una cuenta del plan (sin precarga, RN-135)' })
  crearCuenta(@Body() dto: CrearCuentaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contabilidad.crearCuenta(dto, actor);
  }

  @Get('plan-cuentas')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Plan de cuentas del comercio' })
  listarCuentas(@CurrentUser() actor: AuthenticatedUser) {
    return this.contabilidad.listarCuentas(actor);
  }

  // Mapeo evento → cuenta
  @Post('config-cuentas')
  @RequierePermisos('contabilidad:crear')
  @ApiOperation({ summary: 'Configurar la cuenta de un evento contable (asientos automáticos)' })
  setConfig(@Body() dto: ConfigCuentaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contabilidad.setConfig(dto, actor);
  }

  @Get('config-cuentas')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Mapeo de eventos contables a cuentas' })
  listarConfig(@CurrentUser() actor: AuthenticatedUser) {
    return this.contabilidad.listarConfig(actor);
  }

  // Asientos
  @Post('asientos')
  @RequierePermisos('contabilidad:crear')
  @ApiOperation({ summary: 'Registrar un asiento manual (valida partida doble)' })
  crearAsiento(
    @Body() dto: CrearAsientoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.contabilidad.registrarManual(dto, actor, ip);
  }

  @Get('asientos')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Listar asientos' })
  listarAsientos(@CurrentUser() actor: AuthenticatedUser) {
    return this.contabilidad.listarAsientos(actor);
  }

  // Libros y declaración
  @Get('libros/ventas')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Libro de Ventas del período' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 6 })
  libroVentas(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.libros.libroVentas(actor, Number(year), Number(month));
  }

  @Get('libros/compras')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Libro de Compras del período' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 6 })
  libroCompras(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.libros.libroCompras(actor, Number(year), Number(month));
  }

  @Get('declaraciones/iva')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Resumen de IVA a declarar (débito − crédito − retenciones)' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 6 })
  resumenIva(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.libros.resumenIva(actor, Number(year), Number(month));
  }

  @Post('declaraciones/iva/declarar')
  @RequierePermisos('contabilidad:cerrar_periodo')
  @ApiOperation({ summary: 'Declarar el período de IVA: congela el paquete y lo marca DECLARADA (no declara ante SENIAT)' })
  declararIva(
    @Body() dto: DeclararIvaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.declaraciones.declararIva(dto.year, dto.month, actor, ip, dto.referencia);
  }

  @Get('declaraciones')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Listar declaraciones realizadas (sin el paquete)' })
  listarDeclaraciones(@CurrentUser() actor: AuthenticatedUser) {
    return this.declaraciones.listar(actor);
  }

  @Get('declaraciones/:id')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Detalle de una declaración (incluye el snapshot del paquete)' })
  obtenerDeclaracion(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.declaraciones.obtener(id, actor);
  }
}
