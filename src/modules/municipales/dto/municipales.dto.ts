import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CrearActividadDto {
  @ApiProperty({ example: '620201' })
  @IsString()
  codigo: string;

  @ApiProperty({ example: 'Venta al detal de alimentos' })
  @IsString()
  descripcion: string;

  @ApiProperty({ example: 1.5, description: 'Alícuota en %' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  alicuota: number;
}

export class CalcularImpuestoDto {
  @ApiProperty({ description: 'ID de la actividad económica' })
  @IsUUID()
  actividadId: string;

  @ApiProperty({ example: '2026-06', description: 'Período (YYYY-MM)' })
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodo debe ser YYYY-MM' })
  periodo: string;

  @ApiProperty({ description: 'Base imponible (ingresos del período)' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  base: number;
}

export class RegistrarPagoMunicipalDto {
  @ApiProperty({ example: 'REF-123456' })
  @IsString()
  referencia: string;

  @ApiProperty({ example: '2026-06-21' })
  @IsDateString()
  fecha: string;
}
