import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearProductoDto } from './crear-producto.dto';

/** Igual que crear pero todo opcional y sin el código (el código no cambia tras el alta). */
export class ActualizarProductoDto extends PartialType(
  OmitType(CrearProductoDto, ['codigo'] as const),
) {}
