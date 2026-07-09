import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ItemFacturaDto, MetodoPagoDto } from './emitir-factura.dto';

/**
 * Nota de Crédito o Débito. Siempre referencia una factura existente (RN-002).
 * Los ítems son los afectados (devolución/ajuste); pueden ser parciales.
 */
export class EmitirNotaDto {
  @ApiProperty({ description: 'ID de la factura afectada (debe estar emitida)' })
  @IsUUID()
  facturaOrigenId: string;

  @ApiPropertyOptional({ example: 'Devolución parcial de mercancía' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({ type: [ItemFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemFacturaDto)
  items: ItemFacturaDto[];

  @ApiPropertyOptional({
    enum: MetodoPagoDto,
    description: 'Método usado para reembolsar al cliente (Nota de Crédito). Si se omite, se copia el de la factura origen.',
  })
  @IsOptional()
  @IsEnum(MetodoPagoDto)
  metodoPago?: MetodoPagoDto;
}
