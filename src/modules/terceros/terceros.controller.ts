import { Body, Controller, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarTerceroDto } from './dto/actualizar-tercero.dto';
import { CrearTerceroDto } from './dto/crear-tercero.dto';
import { TercerosService } from './terceros.service';

@ApiTags('terceros')
@ApiBearerAuth()
@Controller('terceros')
export class TercerosController {
  constructor(private readonly terceros: TercerosService) {}

  @Post()
  @RequierePermisos('terceros:crear')
  @ApiOperation({ summary: 'Registrar un cliente/proveedor (valida RIF ante el SENIAT)' })
  crear(
    @Body() dto: CrearTerceroDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.terceros.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('terceros:ver')
  @ApiOperation({ summary: 'Listar/buscar terceros del comercio' })
  @ApiQuery({ name: 'tipo', required: false, enum: ['cliente', 'proveedor'] })
  @ApiQuery({ name: 'q', required: false, description: 'Búsqueda por nombre o RIF' })
  listar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('tipo') tipo?: 'cliente' | 'proveedor',
    @Query('q') q?: string,
  ) {
    return this.terceros.listar(actor, tipo, q);
  }

  @Get(':id')
  @RequierePermisos('terceros:ver')
  @ApiOperation({ summary: 'Detalle de un tercero' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.terceros.obtener(id, actor);
  }

  @Patch(':id')
  @RequierePermisos('terceros:editar')
  @ApiOperation({ summary: 'Actualizar un tercero' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarTerceroDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.terceros.actualizar(id, dto, actor, ip);
  }

  @Post(':id/validar-rif')
  @RequierePermisos('terceros:editar')
  @ApiOperation({ summary: 'Validar el RIF de un tercero contra el padrón del SENIAT' })
  validarRif(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.terceros.validarRif(id, actor, ip);
  }
}
