import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum TipoCuentaDto {
  ACTIVO = 'ACTIVO',
  PASIVO = 'PASIVO',
  PATRIMONIO = 'PATRIMONIO',
  INGRESO = 'INGRESO',
  GASTO = 'GASTO',
}

export class CrearCuentaDto {
  @ApiProperty({ example: '1.1.1.01' })
  @IsString()
  codigo: string;

  @ApiProperty({ example: 'Caja' })
  @IsString()
  nombre: string;

  @ApiProperty({ enum: TipoCuentaDto })
  @IsEnum(TipoCuentaDto)
  tipo: TipoCuentaDto;
}

export class ConfigCuentaDto {
  @ApiProperty({ example: 'venta_ingreso', description: 'Nombre del evento contable' })
  @IsString()
  evento: string;

  @ApiProperty({ description: 'ID de la cuenta del plan' })
  @IsUUID()
  cuentaId: string;
}

export class LineaAsientoDto {
  @ApiProperty({ description: 'ID de la cuenta' })
  @IsUUID()
  cuentaId: string;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  debe: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  haber: number;
}

export class CrearAsientoDto {
  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: 'Pago de servicios' })
  @IsString()
  glosa: string;

  @ApiProperty({ type: [LineaAsientoDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => LineaAsientoDto)
  lineas: LineaAsientoDto[];
}
