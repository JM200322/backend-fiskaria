import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ActualizarPuntoEmisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Activar/desactivar el punto de emisión' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
