import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseFilters,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SigatExceptionFilter } from './sigat-exception.filter';
import { SigatService } from './sigat.service';

/**
 * Consulta de datos municipales reales vía SIGAT (RN-140). Todo el módulo es de
 * lectura y acotado al comercio autenticado; el id SIGAT se resuelve de su RIF.
 */
@ApiTags('sigat')
@ApiBearerAuth()
@UseFilters(SigatExceptionFilter)
@Controller('sigat')
export class SigatController {
  constructor(private readonly sigat: SigatService) {}

  @Get('estado')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Estado de conexión con SIGAT' })
  estado() {
    return this.sigat.verificarConexion();
  }

  @Get('mi-contribuyente')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Perfil municipal del comercio y sus alcaldías' })
  miContribuyente(@CurrentUser() actor: AuthenticatedUser) {
    return this.sigat.miContribuyente(this.tenant(actor));
  }

  @Get('consolidado-financiero')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Consolidado financiero por alcaldía (bancos y métodos de pago)' })
  consolidado(@CurrentUser() actor: AuthenticatedUser) {
    return this.sigat.consolidadoFinanciero(this.tenant(actor));
  }

  @Get('alcaldias/:alcaldiaId/obligaciones')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Obligaciones tributarias habilitadas en una alcaldía' })
  obligaciones(
    @Param('alcaldiaId', ParseIntPipe) alcaldiaId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sigat.obligaciones(this.tenant(actor), alcaldiaId);
  }

  @Get('licencias-activas')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Licencias vigentes del comercio' })
  licenciasActivas(@CurrentUser() actor: AuthenticatedUser) {
    return this.sigat.licenciasActivas(this.tenant(actor));
  }

  @Get('licencias/:licenciaId')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Detalle de una licencia' })
  licencia(
    @Param('licenciaId', ParseIntPipe) licenciaId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sigat.licencia(this.tenant(actor), licenciaId);
  }

  @Get('alcaldias/:alcaldiaId/tipos-vehiculo')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Catálogo de tipos de vehículo de una alcaldía' })
  tiposVehiculo(@Param('alcaldiaId', ParseIntPipe) alcaldiaId: number) {
    return this.sigat.tiposVehiculo(alcaldiaId);
  }

  @Get('vehiculos/:vehiculoId')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Ficha de un vehículo del comercio' })
  vehiculo(
    @Param('vehiculoId', ParseIntPipe) vehiculoId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sigat.vehiculo(this.tenant(actor), vehiculoId);
  }

  @Get('documentos')
  @RequierePermisos('municipales:ver')
  @ApiOperation({ summary: 'Documentos cargados del comercio' })
  documentos(@CurrentUser() actor: AuthenticatedUser) {
    return this.sigat.documentos(this.tenant(actor));
  }

  private tenant(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('La consulta municipal requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
