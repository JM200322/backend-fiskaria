import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConductorDto {
  @ApiProperty({ example: 'Pedro Conductor' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'V-12345678-9', description: 'Cédula/RIF del conductor' })
  @IsString()
  documento: string;
}

export class VehiculoDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  placa: string;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'Hilux' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'Blanco' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class ItemGuiaDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ example: 10, description: 'Peso en kg de la línea' })
  @IsNumber()
  @Min(0)
  pesoKg: number;
}

export class EmitirGuiaDto {
  @ApiProperty()
  @IsUUID()
  puntoEmisionId: string;

  @ApiProperty({ description: 'Cliente/destinatario (Tercero)' })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ example: 'Entrega de mercancía' })
  @IsString()
  motivo: string;

  @ApiProperty({ example: 'Almacén Caracas' })
  @IsString()
  direccionOrigen: string;

  @ApiProperty({ example: 'Cliente, Caracas' })
  @IsString()
  direccionDestino: string;

  @ApiProperty({ type: ConductorDto })
  @ValidateNested()
  @Type(() => ConductorDto)
  conductor: ConductorDto;

  @ApiProperty({ type: VehiculoDto })
  @ValidateNested()
  @Type(() => VehiculoDto)
  vehiculo: VehiculoDto;

  @ApiPropertyOptional({ description: 'Orden de compra asociada' })
  @IsOptional()
  @IsString()
  ordenCompra?: string;

  @ApiPropertyOptional({ description: 'Tasa BCV. Si se omite, se toma del servicio de tasas.' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  tasaBcv?: number;

  @ApiProperty({ type: [ItemGuiaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemGuiaDto)
  items: ItemGuiaDto[];
}
