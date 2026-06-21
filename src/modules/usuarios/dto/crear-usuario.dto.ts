import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'operador@comercio.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Operador' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Correo alternativo para recuperación (RN-014)' })
  @IsOptional()
  @IsEmail()
  emailAlternativo?: string;

  @ApiProperty({ type: [String], description: 'Roles a asignar (por nombre)', example: ['Operador'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roles: string[];
}
