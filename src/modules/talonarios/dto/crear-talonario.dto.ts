import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

/** Rango secuencial de Providencia 00071: hasta 8 dígitos (1 – 99.999.999). */
const SECUENCIAL_MIN = 1;
const SECUENCIAL_MAX = 99_999_999;

export class CrearTalonarioDto {
  @ApiProperty({ example: '01', description: 'Serie de 2 dígitos (máquina fiscal) — Providencia 00071' })
  @IsString()
  @Matches(/^\d{2}$/, { message: 'serie debe ser de 2 dígitos, ej. "01"' })
  serie: string;

  @ApiProperty({ example: 1, description: 'Límite inferior del rango autorizado' })
  @IsInt()
  @Min(SECUENCIAL_MIN)
  @Max(SECUENCIAL_MAX)
  desde: number;

  @ApiProperty({ example: 500, description: 'Límite superior del rango autorizado' })
  @IsInt()
  @Min(SECUENCIAL_MIN)
  @Max(SECUENCIAL_MAX)
  hasta: number;

  @ApiProperty({ example: 'SNAT/2026/00071-A', description: 'N° de providencia de autorización del SENIAT' })
  @IsString()
  providenciaNum: string;
}
