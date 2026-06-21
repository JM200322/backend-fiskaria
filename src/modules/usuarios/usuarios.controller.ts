import { Body, Controller, Get, Ip, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Post()
  @RequierePermisos('usuarios:crear')
  @ApiOperation({ summary: 'Crear usuario (devuelve la clave temporal a comunicar)' })
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.usuarios.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('usuarios:ver')
  @ApiOperation({ summary: 'Listar usuarios del comercio' })
  listar(@CurrentUser() actor: AuthenticatedUser) {
    return this.usuarios.listar(actor);
  }

  @Get(':id')
  @RequierePermisos('usuarios:ver')
  @ApiOperation({ summary: 'Detalle de un usuario' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usuarios.obtener(id, actor);
  }

  @Patch(':id')
  @RequierePermisos('usuarios:editar')
  @ApiOperation({ summary: 'Actualizar usuario (datos, estado, roles)' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.usuarios.actualizar(id, dto, actor, ip);
  }

  @Post(':id/reset-password')
  @RequierePermisos('usuarios:editar')
  @ApiOperation({ summary: 'Restablecer la contraseña a una temporal' })
  resetPassword(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.usuarios.resetPassword(id, actor, ip);
  }
}
