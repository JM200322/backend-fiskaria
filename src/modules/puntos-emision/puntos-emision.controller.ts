import { Body, Controller, Get, Ip, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarPuntoEmisionDto } from './dto/actualizar-punto-emision.dto';
import { CrearPuntoEmisionDto } from './dto/crear-punto-emision.dto';
import { PuntosEmisionService } from './puntos-emision.service';

@ApiTags('puntos-emision')
@ApiBearerAuth()
@Controller('puntos-emision')
export class PuntosEmisionController {
  constructor(private readonly puntos: PuntosEmisionService) {}

  @Post()
  @RequierePermisos('puntos-emision:crear')
  @ApiOperation({ summary: 'Crear punto de emisión (inicializa su numeración)' })
  crear(
    @Body() dto: CrearPuntoEmisionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.puntos.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('puntos-emision:ver')
  @ApiOperation({ summary: 'Listar puntos de emisión del comercio' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.puntos.listar(actor);
  }

  @Get(':id')
  @RequierePermisos('puntos-emision:ver')
  @ApiOperation({ summary: 'Detalle de un punto de emisión (incluye sus contadores)' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.puntos.obtener(id, actor);
  }

  @Patch(':id')
  @RequierePermisos('puntos-emision:editar')
  @ApiOperation({ summary: 'Actualizar/activar/desactivar un punto de emisión' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPuntoEmisionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.puntos.actualizar(id, dto, actor, ip);
  }
}
