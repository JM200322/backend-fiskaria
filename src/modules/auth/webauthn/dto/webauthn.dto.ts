import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

/**
 * `response` solo lleva @IsObject(): es el JSON crudo que produce
 * @simplewebauthn/browser (anidado, forma fija por spec WebAuthn, no vale la
 * pena declarar cada campo). Sin ALGÚN decorador de class-validator la
 * propiedad no sobrevive (TS borra la anotación de tipo en runtime; sin
 * metadata registrada, ValidationPipe con forbidNonWhitelisted la rechaza como
 * "should not exist"). El verdadero guardián es verifyRegistrationResponse/
 * verifyAuthenticationResponse: si el JSON no es válido, lanzan o devuelven
 * verified:false.
 */
export class VerificarRegistroPasskeyDto {
  @ApiProperty({ description: 'Respuesta de navigator.credentials.create() (@simplewebauthn/browser)' })
  @IsObject()
  response: RegistrationResponseJSON;

  @ApiPropertyOptional({ example: 'iPhone de Mariana' })
  @IsOptional()
  @IsString()
  deviceLabel?: string;
}

export class VerificarLoginPasskeyDto {
  @ApiProperty({ description: 'Respuesta de navigator.credentials.get() (@simplewebauthn/browser)' })
  @IsObject()
  response: AuthenticationResponseJSON;
}
