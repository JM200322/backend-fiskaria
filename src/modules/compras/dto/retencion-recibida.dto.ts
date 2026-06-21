import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum TipoRetencionDto {
  IVA = 'IVA',
  ISLR = 'ISLR',
}

/** Registro de una retención que nos practicó un cliente (RN-133). */
export class RegistrarRetencionRecibidaDto {
  @ApiProperty({ enum: TipoRetencionDto })
  @IsEnum(TipoRetencionDto)
  tipo: TipoRetencionDto;

  @ApiProperty({ description: 'Número del comprobante emitido por el agente (cliente)' })
  @IsString()
  numero: string;

  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ description: 'RIF del agente que retuvo (cliente)' })
  @IsString()
  agenteRif: string;

  @ApiPropertyOptional({ description: 'Nombre del agente' })
  @IsOptional()
  @IsString()
  agenteNombre?: string;

  @ApiPropertyOptional({ description: 'Nuestra factura sobre la que retuvieron' })
  @IsOptional()
  @IsString()
  facturaRef?: string;

  @ApiProperty({ description: 'Base de la retención' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  base: number;

  @ApiProperty({ description: 'Monto retenido' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monto: number;
}
