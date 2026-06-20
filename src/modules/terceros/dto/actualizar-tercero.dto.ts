import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CrearTerceroDto } from './crear-tercero.dto';

/** Igual que crear pero todo opcional y sin el RIF (el RIF no se cambia tras el alta). */
export class ActualizarTerceroDto extends PartialType(
  OmitType(CrearTerceroDto, ['rif'] as const),
) {}
