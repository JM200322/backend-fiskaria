import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { esRifFormatoValido, normalizarRif } from 'src/common/fiscal/rif.util';
import { ResultadoValidacionSeniat, SeniatValidationError } from './seniat.types';

/**
 * Cliente del Validador de Contribuyentes del SENIAT (RN-101).
 * Contrato: GET {base}/rif/:rif (público) → { rif, nombreCompleto, tipoContribuyente }.
 * Errores: 400 (formato), 404 (inexistente/inactivo), 503 (no disponible).
 *
 * En modo mock (dev) no golpea la API real; simula respuestas para poder probar
 * el flujo (RIF que contiene "404" → no encontrado; "503" → no disponible).
 */
@Injectable()
export class SeniatService {
  private readonly logger = new Logger(SeniatService.name);

  constructor(private readonly config: ConfigService) {}

  async validarRif(rifEntrada: string): Promise<ResultadoValidacionSeniat> {
    const rif = normalizarRif(rifEntrada);
    if (!esRifFormatoValido(rif)) {
      throw new SeniatValidationError('RIF_INVALIDO', `Formato de RIF inválido: ${rifEntrada}`);
    }

    if (this.config.get<boolean>('seniat.mock')) {
      return this.validarMock(rif);
    }
    return this.validarReal(rif);
  }

  private validarMock(rif: string): ResultadoValidacionSeniat {
    if (rif.includes('404')) {
      throw new SeniatValidationError('NO_ENCONTRADO', 'RIF inexistente o inactivo (mock)');
    }
    if (rif.includes('503')) {
      throw new SeniatValidationError('NO_DISPONIBLE', 'Servicio SENIAT no disponible (mock)');
    }
    this.logger.warn(`SENIAT en modo MOCK: validación simulada para ${rif}`);
    return {
      rif,
      nombreCompleto: `CONTRIBUYENTE DEMO ${rif}`,
      tipoContribuyente: rif.includes('777') ? 'Especial' : 'Ordinario',
    };
  }

  private async validarReal(rif: string): Promise<ResultadoValidacionSeniat> {
    const base = this.config.get<string>('seniat.validadorUrl');
    const timeoutMs = this.config.get<number>('seniat.timeoutMs') ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${base}/rif/${rif}`, { signal: controller.signal });
      if (res.status === 400) {
        throw new SeniatValidationError('RIF_INVALIDO', 'RIF inválido según el SENIAT');
      }
      if (res.status === 404) {
        throw new SeniatValidationError('NO_ENCONTRADO', 'RIF inexistente o inactivo');
      }
      if (!res.ok) {
        throw new SeniatValidationError('NO_DISPONIBLE', `SENIAT respondió ${res.status}`);
      }
      const data = (await res.json()) as ResultadoValidacionSeniat;
      return { ...data, rif: normalizarRif(data.rif ?? rif) };
    } catch (e) {
      if (e instanceof SeniatValidationError) throw e;
      this.logger.error('Fallo al consultar el validador del SENIAT', e as Error);
      throw new SeniatValidationError('NO_DISPONIBLE', 'No se pudo contactar al SENIAT');
    } finally {
      clearTimeout(timer);
    }
  }
}
