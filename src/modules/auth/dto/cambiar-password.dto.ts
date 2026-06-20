import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @ApiProperty({ description: 'Contraseña actual (o temporal)' })
  @IsString()
  actual: string;

  @ApiProperty({ example: 'NuevaClave1234' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  nueva: string;
}
