import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContribuyentesService } from './contribuyentes.service';
import { CrearContribuyenteDto } from './dto/crear-contribuyente.dto';

@ApiTags('contribuyentes')
@ApiBearerAuth()
@Controller('contribuyentes')
export class ContribuyentesController {
  constructor(private readonly contribuyentes: ContribuyentesService) {}

  @Post()
  @RequierePermisos('contribuyentes:crear')
  @ApiOperation({ summary: 'Alta de un comercio (Sirumatek) con validación SENIAT' })
  crear(
    @Body() dto: CrearContribuyenteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.contribuyentes.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('contribuyentes:ver')
  @ApiOperation({ summary: 'Lista de contribuyentes (acotada por rol/tenant)' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.contribuyentes.listar(actor);
  }

  @Get(':id')
  @RequierePermisos('contribuyentes:ver')
  @ApiOperation({ summary: 'Perfil fiscal de un contribuyente' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.contribuyentes.obtener(id, actor);
  }

  @Post(':id/validar')
  @RequierePermisos('contribuyentes:validar')
  @ApiOperation({ summary: 'Dispara la validación del contribuyente ante el SENIAT' })
  validar(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.contribuyentes.validar(id, actor, ip);
  }
}
