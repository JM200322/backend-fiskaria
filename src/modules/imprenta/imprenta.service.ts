import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImprentaError,
  ImprentaFacturaPayload,
  ImprentaGuiaPayload,
  ImprentaNotaCreditoPayload,
  ImprentaNotaDebitoPayload,
  ImprentaRespuesta,
  ImprentaRetencionIslrPayload,
  ImprentaRetencionIvaPayload,
} from './imprenta.types';

/**
 * Adaptador de la Imprenta Digital (capa anticorrupción): aísla los nombres "con rarezas"
 * del API y el transporte HTTP. El resto del sistema no conoce el contrato externo.
 *
 * Modo mock (dev): simula la asignación del número de control sin llamar a la imprenta real
 * (cuyo contrato aún está incompleto: URL, auth, formato de respuesta).
 * Para probar el camino "no enviado", el mock falla si el RIF del cliente contiene "999".
 */
@Injectable()
export class ImprentaService {
  private readonly logger = new Logger(ImprentaService.name);

  constructor(private readonly config: ConfigService) {}

  async generarFactura(payload: ImprentaFacturaPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post('/generateBill', payload);
  }

  async generarNotaCredito(payload: ImprentaNotaCreditoPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post('/generateCreditNote', payload);
  }

  async generarNotaDebito(payload: ImprentaNotaDebitoPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post('/generateDebitNote', payload);
  }

  async generarRetencionIva(payload: ImprentaRetencionIvaPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.beneficiary_doc_id);
    }
    return this.post('/generateVoucherIVA', payload);
  }

  async generarRetencionIslr(payload: ImprentaRetencionIslrPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.beneficiary_doc_id);
    }
    return this.post('/generateVoucherIslr', payload);
  }

  async generarGuiaDespacho(payload: ImprentaGuiaPayload): Promise<ImprentaRespuesta> {
    if (this.config.get<boolean>('imprenta.mock')) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post('/generateShippingOrder', payload);
  }

  /** Simulación común (dev): falla si el RIF del cliente contiene "999". */
  private simular(docNum: string, clientIdNum?: string): ImprentaRespuesta {
    if (clientIdNum?.includes('999')) {
      throw new ImprentaError('Imprenta no disponible (mock)');
    }
    this.logger.warn(`Imprenta en modo MOCK: número de control simulado para ${docNum}`);
    return { numeroControl: `00-${docNum}`, estatus: 'EMITIDO' };
  }

  private async post(ruta: string, payload: unknown): Promise<ImprentaRespuesta> {
    const base = this.config.get<string>('imprenta.baseUrl');
    if (!base) {
      throw new ImprentaError('IMPRENTA_BASE_URL no configurada');
    }
    const timeoutMs = this.config.get<number>('imprenta.timeoutMs') ?? 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ImprentaError(`La imprenta respondió ${res.status}`);
      }
      // TODO: ajustar al formato real de respuesta cuando Sirumatek lo defina.
      const data = (await res.json()) as { numeroControl?: string; estatus?: string };
      if (!data.numeroControl) {
        throw new ImprentaError('Respuesta de la imprenta sin número de control');
      }
      return { numeroControl: data.numeroControl, estatus: data.estatus ?? 'EMITIDO' };
    } catch (e) {
      if (e instanceof ImprentaError) throw e;
      this.logger.error('Fallo al contactar la imprenta', e as Error);
      throw new ImprentaError('No se pudo contactar la imprenta');
    } finally {
      clearTimeout(timer);
    }
  }
}
