import { Module } from '@nestjs/common';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ContabilidadModule], // reutiliza LibrosService (resumen de IVA)
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
