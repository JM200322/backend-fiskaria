import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ActualizarContribuyenteDto {
  @ApiPropertyOptional({ description: 'Razón social' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razonSocial?: string;

  @ApiPropertyOptional({ description: 'Domicilio fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  domicilioFiscal?: string;

  @ApiPropertyOptional({
    description: 'URL base de la API de la imprenta digital Sirumatek',
    example: 'https://imprentaapidev.sirumatek.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^https?:\/\/.+/i, { message: 'imprentaBaseUrl debe comenzar con http:// o https://' })
  imprentaBaseUrl?: string;

  @ApiPropertyOptional({
    description:
      'Token API-T-Token (<id>|<secret>). Solo se escribe; nunca se devuelve en lecturas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  imprentaApiToken?: string;
}
