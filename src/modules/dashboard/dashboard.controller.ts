import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DashboardService, RangoVentas } from './dashboard.service';

const RANGOS: RangoVentas[] = ['7d', '30d', 'anio'];

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('resumen')
  @RequierePermisos('dashboard:ver')
  @ApiOperation({ summary: 'Resumen del período: ventas, situación fiscal y alertas' })
  resumen(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboard.resumen(actor);
  }

  @Get('ventas')
  @RequierePermisos('dashboard:ver')
  @ApiOperation({ summary: 'Serie de ventas para el gráfico (7d / 30d / anio)' })
  @ApiQuery({ name: 'rango', enum: RANGOS })
  ventas(@CurrentUser() actor: AuthenticatedUser, @Query('rango') rango: RangoVentas = '7d') {
    if (!RANGOS.includes(rango)) {
      throw new BadRequestException('rango debe ser 7d, 30d o anio');
    }
    return this.dashboard.ventas(actor, rango);
  }
}
