import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class ReponerStockDto {
  @ApiProperty({ example: 24, description: 'Unidades que entran al inventario' })
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ example: 18.5, description: 'Costo unitario de la reposición (Bs.)' })
  @IsNumber()
  @IsPositive()
  costoUnitario: number;

  @ApiPropertyOptional({ description: 'IVA crédito de la compra, si aplica', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ivaCredito?: number;

  @ApiPropertyOptional({ description: 'Referencia (factura de proveedor, etc.)' })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional({
    description:
      'ID de la línea de factura (CompraItem) que esta reposición cubre — si viene, se topa ' +
      'la cantidad contra lo que la factura indica para este producto (RN-134).',
  })
  @IsOptional()
  @IsUUID()
  compraItemId?: string;
}
