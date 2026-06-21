import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsPositive, IsUUID, ValidateNested } from 'class-validator';
import { PagoDto } from '../../facturador/dto/emitir-factura.dto';

/** Convierte una venta confirmada en factura: agrega lo que el Facturador necesita. */
export class ConvertirVentaDto {
  @ApiProperty({ description: 'ID del punto de emisión' })
  @IsUUID()
  puntoEmisionId: string;

  @ApiProperty({ description: 'Tasa BCV usada (Bs por USD), se persiste en la factura' })
  @IsNumber()
  @IsPositive()
  tasaBcv: number;

  @ApiProperty({ type: [PagoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos: PagoDto[];
}
