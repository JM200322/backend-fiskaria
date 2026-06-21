import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RecuperarDto {
  @ApiProperty({ example: 'usuario@comercio.com' })
  @IsEmail()
  email: string;
}
