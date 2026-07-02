import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Condición fiscal del sujeto retenido (define tarifa/sustraendo, decreto 1.808). */
export enum CondicionFiscalDto {
  PNR = 'PNR', // Persona Natural Residente
  PNNR = 'PNNR', // Persona Natural No Residente
  PJD = 'PJD', // Persona Jurídica Domiciliada
  PJND = 'PJND', // Persona Jurídica No Domiciliada
}

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

  @ApiPropertyOptional({ example: '001', description: 'Código de retención ISLR (SENIAT)' })
  @IsOptional()
  @IsString()
  retentionCode?: string;

  @ApiProperty({
    enum: CondicionFiscalDto,
    description: 'Condición fiscal del retenido (define tarifa/sustraendo)',
  })
  @IsEnum(CondicionFiscalDto)
  condicionFiscal: CondicionFiscalDto;

  @ApiPropertyOptional({
    description: 'Sustraendo en Bs (personas naturales). Resta del impuesto: base×% − sustraendo.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sustraendo?: number;
}
