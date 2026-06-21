import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Base de las retenciones (IVA/ISLR). El % exacto es parámetro (pendiente revisor fiscal). */
export class EmitirRetencionDto {
  @ApiProperty({ description: 'ID de la compra a la que se aplica la retención' })
  @IsUUID()
  compraId: string;

  @ApiProperty({ description: 'ID del punto de emisión (para la numeración)' })
  @IsUUID()
  puntoEmisionId: string;

  @ApiPropertyOptional({ description: 'Porcentaje a retener. Por defecto: IVA 75%, ISLR 3%.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje?: number;
}

export class EmitirRetencionIslrDto extends EmitirRetencionDto {
  @ApiProperty({ example: 'Honorarios profesionales' })
  @IsString()
  concepto: string;

  @ApiPropertyOptional({ example: '001', description: 'Código de retención ISLR' })
  @IsOptional()
  @IsString()
  retentionCode?: string;
}
