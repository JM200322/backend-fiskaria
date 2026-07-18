import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import {  ImprentaError,
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
 * Modo mock (dev): solo si IMPRENTA_MOCK=true y el comercio no tiene credenciales en
 * Configuración. Las credenciales por tenant anulan el mock global.
 */
@Injectable()
export class ImprentaService {
  private readonly logger = new Logger(ImprentaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async generarFactura(contribuyenteId: string, payload: ImprentaFacturaPayload): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post(contribuyenteId, '/api/generateBill', payload);
  }

  async generarNotaCredito(
    contribuyenteId: string,
    payload: ImprentaNotaCreditoPayload,
  ): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post(contribuyenteId, '/api/generateCreditNote', payload);
  }

  async generarNotaDebito(
    contribuyenteId: string,
    payload: ImprentaNotaDebitoPayload,
  ): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post(contribuyenteId, '/api/generateDebitNote', payload);
  }

  async generarRetencionIva(
    contribuyenteId: string,
    payload: ImprentaRetencionIvaPayload,
  ): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.beneficiary_doc_id);
    }
    return this.post(contribuyenteId, '/api/generateVoucherIVA', payload);
  }

  async generarRetencionIslr(
    contribuyenteId: string,
    payload: ImprentaRetencionIslrPayload,
  ): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.beneficiary_doc_id);
    }
    return this.post(contribuyenteId, '/api/generateVoucherIslr', payload);
  }

  async generarGuiaDespacho(contribuyenteId: string, payload: ImprentaGuiaPayload): Promise<ImprentaRespuesta> {
    if (await this.debeUsarMock(contribuyenteId)) {
      return this.simular(payload.doc_num, payload.client_id_num);
    }
    return this.post(contribuyenteId, '/api/generateShippingOrder', payload);
  }

  /** Comprueba si la imprenta Sirumatek está alcanzable (para el indicador del facturador). */
  async verificarConexion(contribuyenteId: string) {
    const creds = await this.resolverCredenciales(contribuyenteId);
    const verificadoEn = new Date().toISOString();

    if (await this.debeUsarMock(contribuyenteId)) {
      return {
        estado: 'mock' as const,
        mock: true,
        mensaje: 'Modo simulación activo (sin credenciales de imprenta en Configuración)',
        verificadoEn,
      };
    }

    if (!creds?.baseUrl) {
      return {
        estado: 'unconfigured' as const,
        mock: false,
        mensaje: 'Configure la URL de la imprenta en Configuración',
        verificadoEn,
      };
    }

    if (!creds.token) {
      return {
        estado: 'unconfigured' as const,
        mock: false,
        mensaje: 'Configure el token API-T-Token en Configuración',
        verificadoEn,
      };
    }

    const timeoutMs = Math.min(this.config.get<number>('imprenta.timeoutMs') ?? 10000, 5000);
    const inicio = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${creds.baseUrl}/up`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'API-T-Token': creds.token },
        signal: controller.signal,
      });
      const latenciaMs = Date.now() - inicio;

      if (res.ok || res.status < 500) {
        return {
          estado: 'connected' as const,
          mock: false,
          mensaje: 'Imprenta Sirumatek responde',
          verificadoEn,
          latenciaMs,
        };
      }

      return {
        estado: 'degraded' as const,
        mock: false,
        mensaje: `Imprenta respondió HTTP ${res.status}`,
        verificadoEn,
        latenciaMs,
      };
    } catch {
      return {
        estado: 'offline' as const,
        mock: false,
        mensaje: 'No se pudo contactar la imprenta Sirumatek',
        verificadoEn,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Simulación común (dev): falla si el RIF del cliente contiene "999". */
  private simular(docNum: string, clientIdNum?: string): ImprentaRespuesta {
    if (clientIdNum?.includes('999')) {
      throw new ImprentaError('Imprenta no disponible (mock)');
    }
    this.logger.warn(`Imprenta en modo MOCK: número de control simulado para ${docNum}`);
    return {
      numeroControl: `00-${docNum}`,
      estatus: 'EMITIDO',
      idRemoto: `mock-${docNum}`,
      hashVerificacion: `mock-${docNum}`,
      urlPublica: '',
      urlVerificacion: '',
    };
  }

  private async debeUsarMock(contribuyenteId: string): Promise<boolean> {
    if (!this.config.get<boolean>('imprenta.mock')) return false;
    const row = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { imprentaBaseUrl: true, imprentaApiToken: true },
    });
    const tieneCredsEnBd = Boolean(row?.imprentaBaseUrl?.trim() && row?.imprentaApiToken?.trim());
    // Credenciales guardadas en Configuración anulan el mock global del .env.
    return !tieneCredsEnBd;
  }

  private normalizarBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private async resolverCredenciales(contribuyenteId: string) {
    const row = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { imprentaBaseUrl: true, imprentaApiToken: true },
    });

    const baseUrl = this.normalizarBaseUrl(
      row?.imprentaBaseUrl?.trim() || this.config.get<string>('imprenta.baseUrl')?.trim() || '',
    );
    const token =
      row?.imprentaApiToken?.trim() || this.config.get<string>('imprenta.apiToken')?.trim() || '';

    if (!baseUrl && !token) return null;
    return { baseUrl, token };
  }

  private async post(
    contribuyenteId: string,
    ruta: string,
    payload: unknown,
  ): Promise<ImprentaRespuesta> {
    const creds = await this.resolverCredenciales(contribuyenteId);
    if (!creds?.baseUrl) {
      throw new ImprentaError('URL de imprenta no configurada');
    }
    if (!creds.token) {
      throw new ImprentaError('Token de imprenta no configurado');
    }
    const timeoutMs = this.config.get<number>('imprenta.timeoutMs') ?? 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${creds.baseUrl}${ruta}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'API-T-Token': creds.token,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const cuerpo = (await res.json().catch(() => null)) as ImprentaRespuestaApi | null;

      if (!res.ok || !cuerpo?.success) {
        // La API devuelve el error de varias formas: 422 con { errors: { campo: [msg] } },
        // o { message: "texto" }, o { message: { error: "texto" } }. Se extrae de forma
        // robusta para nunca terminar en "[object Object]".
        const msgs = Object.values(cuerpo?.errors ?? {})
          .flat()
          .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)));
        let detalle: string;
        if (msgs.length) detalle = msgs.join('; ');
        else if (typeof cuerpo?.message === 'string') detalle = cuerpo.message;
        else if (cuerpo?.message && typeof cuerpo.message === 'object')
          detalle = (cuerpo.message as { error?: string }).error ?? JSON.stringify(cuerpo.message);
        else detalle = `HTTP ${res.status}`;
        throw new ImprentaError(`La imprenta rechazó el documento: ${detalle}`);
      }

      const d = cuerpo.data;
      if (!d?.control_num) {
        throw new ImprentaError('Respuesta de la imprenta sin número de control');
      }
      return {
        numeroControl: d.control_num,
        estatus: typeof cuerpo.message === 'string' ? cuerpo.message : 'EMITIDO',
        idRemoto: d.id,
        hashVerificacion: d.verification_hash,
        urlPublica: d.public_url,
        urlVerificacion: d.verification_url,
      };
    } catch (e) {
      if (e instanceof ImprentaError) throw e;
      this.logger.error('Fallo al contactar la imprenta', e as Error);
      throw new ImprentaError('No se pudo contactar la imprenta');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Forma real de la respuesta de la API de Sirumatek (validada contra el sandbox). */
interface ImprentaRespuestaApi {
  success?: boolean;
  message?: string | { error?: string };
  errors?: Record<string, unknown>;
  data?: {
    id?: string;
    control_num?: string;
    verification_hash?: string;
    public_url?: string;
    verification_url?: string;
  };
}
