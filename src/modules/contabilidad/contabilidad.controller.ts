import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContabilidadService } from './contabilidad.service';
import { LibrosService } from './libros.service';
import { ConfigCuentaDto, CrearAsientoDto, CrearCuentaDto } from './dto/contabilidad.dto';

@ApiTags('contabilidad')
@ApiBearerAuth()
@Controller()
export class ContabilidadController {
  constructor(
    private readonly contabilidad: ContabilidadService,
    private readonly libros: LibrosService,
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

  @Get('estado-resultados')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Estado de Resultados del período (derivado del Libro Diario)' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 6 })
  estadoResultados(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.contabilidad.estadoResultados(actor, Number(year), Number(month));
  }

  @Get('ratios')
  @RequierePermisos('contabilidad:ver')
  @ApiOperation({ summary: 'Ratios financieros (solvencia, margen neto — ver nota de limitaciones)' })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 6 })
  ratios(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.contabilidad.ratiosFinancieros(actor, Number(year), Number(month));
  }
}
