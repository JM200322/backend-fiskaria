import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacturadorService } from './facturador.service';

/**
 * Job programado que reintenta los documentos "No enviado" (RN-112). Reemplaza al
 * job PM2 del SDD: aquí vive dentro del backend con @nestjs/schedule.
 */
@Injectable()
export class ReprocesoService {
  private readonly logger = new Logger(ReprocesoService.name);

  constructor(private readonly facturador: FacturadorService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async ejecutar() {
    try {
      const r = await this.facturador.reprocesarNoEnviados();
      if (r.intentados > 0) {
        this.logger.log(`Reproceso "no enviado": ${r.enviados}/${r.intentados} transmitidos`);
      }
    } catch (e) {
      this.logger.error('Fallo en el job de reproceso', e as Error);
    }
  }
}
