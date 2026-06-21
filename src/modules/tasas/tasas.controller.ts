import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasasService } from './tasas.service';

@ApiTags('tasas')
@ApiBearerAuth()
@Controller('tasas')
export class TasasController {
  constructor(private readonly tasas: TasasService) {}

  @Get('ultimas')
  @ApiOperation({ summary: 'Últimas tasas USD/EUR (con fallback a la última conocida)' })
  ultimas() {
    return this.tasas.ultimas();
  }

  @Get('fecha/:fecha')
  @ApiOperation({ summary: 'Tasas de una fecha (YYYY-MM-DD)' })
  porFecha(@Param('fecha') fecha: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('fecha debe ser YYYY-MM-DD');
    }
    return this.tasas.porFecha(fecha);
  }
}
