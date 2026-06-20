import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CrearTerceroDto {
  @ApiProperty({ example: 'V-12345678-9', description: 'RIF/Cédula (con o sin guiones)' })
  @IsString()
  rif: string;

  @ApiPropertyOptional({
    description: 'Nombre/razón social. Si se omite y el RIF valida, se usa el del SENIAT.',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Es cliente (por defecto true si no se indica nada)' })
  @IsOptional()
  @IsBoolean()
  esCliente?: boolean;

  @ApiPropertyOptional({ description: 'Es proveedor' })
  @IsOptional()
  @IsBoolean()
  esProveedor?: boolean;
}
