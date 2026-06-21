import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AuditoriaService } from './auditoria.service';

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @RequierePermisos('usuarios:ver')
  @ApiOperation({ summary: 'Consultar el registro de auditoría (acotado por comercio)' })
  @ApiQuery({ name: 'accion', required: false })
  @ApiQuery({ name: 'entidad', required: false })
  consultar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('accion') accion?: string,
    @Query('entidad') entidad?: string,
  ) {
    return this.auditoria.consultar(actor.contribuyenteId, { accion, entidad });
  }
}
