import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PagoDto } from '../../facturador/dto/emitir-factura.dto';

/** Convierte una venta confirmada en factura: agrega lo que el Facturador necesita. */
export class ConvertirVentaDto {
  @ApiProperty({ description: 'ID del punto de emisión' })
  @IsUUID()
  puntoEmisionId: string;

  @ApiPropertyOptional({ description: 'Tasa BCV. Si se omite, se toma del servicio de tasas.' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  tasaBcv?: number;

  @ApiProperty({ type: [PagoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos: PagoDto[];
}
