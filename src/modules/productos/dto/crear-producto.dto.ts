import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum TipoProductoDto {
  ALMACENABLE = 'ALMACENABLE',
  CONSUMIBLE = 'CONSUMIBLE',
  SERVICIO = 'SERVICIO',
}

export class CrearProductoDto {
  @ApiProperty({ example: 'PROD-001' })
  @IsString()
  codigo: string;

  @ApiProperty({ example: 'Harina de maíz 1kg' })
  @IsString()
  nombre: string;

  @ApiProperty({ enum: TipoProductoDto, default: TipoProductoDto.ALMACENABLE })
  @IsEnum(TipoProductoDto)
  tipo: TipoProductoDto;

  @ApiProperty({ description: 'ID de la categoría fiscal (determina el IVA)' })
  @IsUUID()
  categoriaFiscalId: string;

  @ApiPropertyOptional({ description: 'ID de categoría comercial (organizativa)' })
  @IsOptional()
  @IsUUID()
  categoriaComercialId?: string;

  @ApiPropertyOptional({
    description: 'Sobrescribe la alícuota de la categoría fiscal (%) — RN-102',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ivaOverride?: number;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @IsPositive()
  precio: number;

  @ApiPropertyOptional({ description: 'Stock inicial (solo aplica a ALMACENABLE)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'Umbral para alerta de stock bajo', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMinimo?: number;

  @ApiPropertyOptional({ type: [String], description: 'IDs de terceros proveedores' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  proveedorIds?: string[];
}
