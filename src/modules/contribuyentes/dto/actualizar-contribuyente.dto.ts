import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarContribuyenteDto {
  @ApiPropertyOptional({ description: 'Razón social' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @ApiPropertyOptional({ description: 'Domicilio fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  domicilioFiscal?: string;
}
