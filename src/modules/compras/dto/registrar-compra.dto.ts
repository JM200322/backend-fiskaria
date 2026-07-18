import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Línea de la factura: qué producto y cuánto trae — habilita el match con
 * Reponer Stock (RN-134). Opcional: una compra sin líneas queda como antes. */
export class CompraItemDto {
  @ApiProperty({ description: 'ID del producto (Almacenable)' })
  @IsUUID()
  productoId: string;

  @ApiProperty({ example: 24 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cantidad: number;

  @ApiProperty({ example: 18.5 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  costoUnitario: number;
}

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

  @ApiPropertyOptional({
    type: [CompraItemDto],
    description:
      'Líneas de la factura (producto/cantidad/costo) — opcional. Habilita que Reponer Stock ' +
      'matchee esta factura y tope la cantidad repuesta contra lo facturado (RN-134).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompraItemDto)
  items?: CompraItemDto[];
}

export class RegistrarPagoProveedorDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
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
