import {
  BadRequestException,
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { TasasService } from './tasas.service';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
export class TasasController {
  constructor(private readonly tasasService: TasasService) {}

  @Get('health')
  health(): { ok: boolean; servicio: string } {
    return { ok: true, servicio: 'tasas-bcv-api' };
  }

  @Get('api/tasas/ultimas')
  getUltimas() {
    return this.tasasService.getUltimas();
  }

  @Get('api/tasas/fecha/:fecha')
  getPorFecha(@Param('fecha') fecha: string) {
    if (!ISO_DATE.test(fecha)) {
      throw new BadRequestException({
        error: 'fecha_invalida',
        mensaje: 'Use fecha en formato YYYY-MM-DD.',
      });
    }

    return this.tasasService.getPorFecha(fecha);
  }
}
