import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CrearTalonarioDto } from './dto/crear-talonario.dto';
import { TalonariosService } from './talonarios.service';

@ApiTags('talonarios')
@ApiBearerAuth()
@Controller('talonarios')
export class TalonariosController {
  constructor(private readonly talonarios: TalonariosService) {}

  @Post()
  @RequierePermisos('configuracion:editar')
  @ApiOperation({ summary: 'Registra un rango de números de control autorizado por el SENIAT' })
  crear(@Body() dto: CrearTalonarioDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.talonarios.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('configuracion:ver')
  @ApiOperation({ summary: 'Lista los talonarios autorizados del comercio' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.talonarios.listar(actor);
  }
}
