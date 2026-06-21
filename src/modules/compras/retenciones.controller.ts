import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EmitirRetencionDto, EmitirRetencionIslrDto } from './dto/emitir-retencion.dto';
import { RetencionesService } from './retenciones.service';

@ApiTags('retenciones')
@ApiBearerAuth()
@Controller('retenciones')
export class RetencionesController {
  constructor(private readonly retenciones: RetencionesService) {}

  @Post('iva')
  @RequierePermisos('compras:crear')
  @ApiOperation({ summary: 'Emitir comprobante de retención de IVA (agente, vía imprenta)' })
  emitirIva(
    @Body() dto: EmitirRetencionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.retenciones.emitirIva(dto, actor, ip);
  }

  @Post('islr')
  @RequierePermisos('compras:crear')
  @ApiOperation({ summary: 'Emitir comprobante de retención de ISLR (agente, vía imprenta)' })
  emitirIslr(
    @Body() dto: EmitirRetencionIslrDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.retenciones.emitirIslr(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('compras:ver')
  @ApiOperation({ summary: 'Listar comprobantes de retención emitidos' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.retenciones.listar(actor);
  }
}
