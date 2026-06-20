import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum PeriodoIvaDto {
  QUINCENAL = 'QUINCENAL',
  MENSUAL = 'MENSUAL',
}

export class CrearContribuyenteDto {
  @ApiProperty({ example: 'J-12345678-9', description: 'RIF (con o sin guiones)' })
  @IsString()
  rif: string;

  @ApiPropertyOptional({
    description: 'Razón social. Si se omite, se usa el nombre devuelto por el SENIAT.',
  })
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @ApiPropertyOptional({ description: 'Domicilio fiscal' })
  @IsOptional()
  @IsString()
  domicilioFiscal?: string;

  @ApiProperty({ description: 'Si es agente de retención (habilita emitir retenciones) — RN-129' })
  @IsBoolean()
  agenteRetencion: boolean;

  @ApiPropertyOptional({
    enum: PeriodoIvaDto,
    description: 'Período de IVA. Si se omite, se deriva del tipo de contribuyente — RN-130',
  })
  @IsOptional()
  @IsEnum(PeriodoIvaDto)
  periodoIva?: PeriodoIvaDto;
}
