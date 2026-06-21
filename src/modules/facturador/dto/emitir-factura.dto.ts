import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum MetodoPagoDto {
  EFECTIVO_BS = 'EFECTIVO_BS',
  DIVISAS = 'DIVISAS',
  PAGO_MOVIL = 'PAGO_MOVIL',
  TARJETA = 'TARJETA',
}

export class ItemFacturaDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productoId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class PagoDto {
  @ApiProperty({ enum: MetodoPagoDto })
  @IsEnum(MetodoPagoDto)
  metodo: MetodoPagoDto;

  @ApiProperty({ description: 'Monto en Bs.' })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiPropertyOptional({ description: 'Marca pago en divisas (activa IGTF 3%)' })
  @IsOptional()
  @IsBoolean()
  esDivisa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  banco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotePos?: string;
}

export class EmitirFacturaDto {
  @ApiProperty({ description: 'ID del punto de emisión' })
  @IsUUID()
  puntoEmisionId: string;

  @ApiProperty({ description: 'ID del tercero cliente (debe tener RIF validado)' })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ type: [ItemFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemFacturaDto)
  items: ItemFacturaDto[];

  @ApiProperty({ type: [PagoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos: PagoDto[];

  @ApiPropertyOptional({
    description: 'Tasa BCV (Bs por USD). Si se omite, se toma del servicio de tasas (RN-118).',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  tasaBcv?: number;

  @ApiPropertyOptional({ description: 'Notificar al cliente por correo', default: true })
  @IsOptional()
  @IsBoolean()
  notificarCliente?: boolean;
}
