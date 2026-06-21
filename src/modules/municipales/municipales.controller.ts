import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EstadoImpuesto } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  CalcularImpuestoDto,
  CrearActividadDto,
  RegistrarPagoMunicipalDto,
} from './dto/municipales.dto';
import { MunicipalesService } from './municipales.service';

@ApiTags('impuestos-municipales')
@ApiBearerAuth()
@Controller()
export class MunicipalesController {
  constructor(private readonly municipales: MunicipalesService) {}

  @Post('actividades-economicas')
  @RequierePermisos('municipales:crear')
  @ApiOperation({ summary: 'Crear una actividad económica (con su alícuota)' })
  crearActividad(@Body() dto: CrearActividadDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.municipales.crearActividad(dto, actor);
  }

  @Get('actividades-economicas')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Listar actividades económicas' })
  listarActividades(@CurrentUser() actor: AuthenticatedUser) {
    return this.municipales.listarActividades(actor);
  }

  @Post('impuestos-municipales')
  @RequierePermisos('municipales:crear')
  @ApiOperation({ summary: 'Calcular el impuesto del período (base × alícuota)' })
  calcular(
    @Body() dto: CalcularImpuestoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.municipales.calcular(dto, actor, ip);
  }

  @Get('impuestos-municipales')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Listar impuestos municipales' })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoImpuesto })
  listarImpuestos(@CurrentUser() actor: AuthenticatedUser, @Query('estado') estado?: EstadoImpuesto) {
    return this.municipales.listarImpuestos(actor, estado);
  }

  @Post('impuestos-municipales/:id/pagar')
  @RequierePermisos('municipales:pagar')
  @ApiOperation({ summary: 'Registrar el comprobante de pago del impuesto' })
  pagar(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoMunicipalDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.municipales.registrarPago(id, dto, actor, ip);
  }
}
