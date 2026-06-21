import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RegistrarCompraDto {
  @ApiProperty({ description: 'ID del proveedor (Tercero con esProveedor)' })
  @IsUUID()
  proveedorId: string;

  @ApiProperty({ description: 'Número de factura del proveedor' })
  @IsString()
  numeroFactura: string;

  @ApiPropertyOptional({ description: 'Número de control fiscal del proveedor (req. para retener, RN-127)' })
  @IsOptional()
  @IsString()
  numeroControl?: string;

  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ description: 'Base imponible' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  base: number;

  @ApiProperty({ description: 'IVA crédito fiscal' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  ivaCredito: number;
}

export class RegistrarPagoProveedorDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monto: number;

  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  fecha: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencia?: string;
}
