import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ItemVentaDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productoId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class CrearVentaDto {
  @ApiProperty({ description: 'ID del cliente (Tercero)' })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ type: [ItemVentaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items: ItemVentaDto[];
}
