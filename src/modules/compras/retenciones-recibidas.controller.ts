import { Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TipoRetencion } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RegistrarRetencionRecibidaDto } from './dto/retencion-recibida.dto';
import { RetencionesRecibidasService } from './retenciones-recibidas.service';

@ApiTags('retenciones-recibidas')
@ApiBearerAuth()
@Controller('retenciones-recibidas')
export class RetencionesRecibidasController {
  constructor(private readonly servicio: RetencionesRecibidasService) {}

  @Post()
  @RequierePermisos('compras:crear')
  @ApiOperation({ summary: 'Registrar una retención que nos practicó un cliente (RN-133)' })
  registrar(
    @Body() dto: RegistrarRetencionRecibidaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.servicio.registrar(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('compras:ver')
  @ApiOperation({ summary: 'Listar retenciones recibidas' })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoRetencion })
  listar(@CurrentUser() actor: AuthenticatedUser, @Query('tipo') tipo?: TipoRetencion) {
    return this.servicio.listar(actor, tipo);
  }
}
