import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  emailAlternativo?: string;

  @ApiPropertyOptional({ description: 'Activar/desactivar el usuario' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Reemplaza los roles del usuario' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
