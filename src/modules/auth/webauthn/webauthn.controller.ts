import { Body, Controller, Delete, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';
import { VerificarLoginPasskeyDto, VerificarRegistroPasskeyDto } from './dto/webauthn.dto';
import { WebauthnService } from './webauthn.service';

@ApiTags('auth-webauthn')
@Controller('auth/webauthn')
export class WebauthnController {
  constructor(private readonly webauthn: WebauthnService) {}

  @Post('registro/opciones')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Genera el desafío para enrolar una passkey (requiere sesión activa)' })
  opcionesRegistro(@CurrentUser() actor: AuthenticatedUser) {
    return this.webauthn.generarOpcionesRegistro(actor);
  }

  @Post('registro/verificar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifica la respuesta del authenticator y guarda la passkey' })
  verificarRegistro(@CurrentUser() actor: AuthenticatedUser, @Body() dto: VerificarRegistroPasskeyDto) {
    return this.webauthn.verificarRegistro(actor, dto);
  }

  @Public()
  @Post('login/opciones')
  @ApiOperation({ summary: 'Genera el desafío de login sin usuario (discoverable credential)' })
  opcionesLogin() {
    return this.webauthn.generarOpcionesLogin();
  }

  @Public()
  @Post('login/verificar')
  @ApiOperation({ summary: 'Verifica la passkey y emite tokens de sesión (igual que /auth/login)' })
  verificarLogin(@Body() dto: VerificarLoginPasskeyDto, @Ip() ip: string) {
    return this.webauthn.verificarLogin(dto, ip);
  }

  @Get('credenciales')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista los dispositivos biométricos enrolados por el usuario' })
  listarCredenciales(@CurrentUser() actor: AuthenticatedUser) {
    return this.webauthn.listarCredenciales(actor);
  }

  @Delete('credenciales/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoca (elimina) una passkey enrolada' })
  revocarCredencial(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.webauthn.revocarCredencial(actor, id);
  }
}
