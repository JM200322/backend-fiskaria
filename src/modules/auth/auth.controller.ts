import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { RecuperarDto } from './dto/recuperar.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthenticatedUser } from './types/authenticated-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.email, dto.password, ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el access token usando el refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('recuperar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recuperar acceso: envía una clave temporal (RN-014)' })
  recuperar(@Body() dto: RecuperarDto, @Ip() ip: string) {
    return this.authService.recuperar(dto.email, ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revoca refresh tokens)' })
  logout(@CurrentUser('id') usuarioId: string) {
    return this.authService.logout(usuarioId);
  }

  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar la contraseña (obligatorio si es temporal, RN-014)' })
  cambiarPassword(
    @CurrentUser('id') usuarioId: string,
    @Body() dto: CambiarPasswordDto,
    @Ip() ip: string,
  ) {
    return this.authService.cambiarPassword(usuarioId, dto.actual, dto.nueva, ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado (roles y permisos)' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
