import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CrearCategoriaComercialDto {
  @ApiProperty({ example: 'Alimentos' })
  @IsString()
  nombre: string;
}
