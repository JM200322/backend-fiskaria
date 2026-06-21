import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ItemFacturaDto } from './emitir-factura.dto';

/**
 * Nota de Crédito o Débito. Siempre referencia una factura existente (RN-002).
 * Los ítems son los afectados (devolución/ajuste); pueden ser parciales.
 */
export class EmitirNotaDto {
  @ApiProperty({ description: 'ID de la factura afectada (debe estar emitida)' })
  @IsUUID()
  facturaOrigenId: string;

  @ApiProperty({ example: 'Devolución parcial de mercancía' })
  @IsString()
  motivo: string;

  @ApiProperty({ type: [ItemFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemFacturaDto)
  items: ItemFacturaDto[];
}
