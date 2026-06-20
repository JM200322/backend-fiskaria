import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CrearPuntoEmisionDto {
  @ApiProperty({ example: '01', description: 'Código de la sucursal/caja (único en el comercio)' })
  @IsString()
  @MaxLength(10)
  codigo: string;

  @ApiProperty({ example: 'Sucursal Principal' })
  @IsString()
  nombre: string;
}
