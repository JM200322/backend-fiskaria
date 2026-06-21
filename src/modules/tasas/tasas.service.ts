import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { PrismaService } from 'src/prisma/prisma.service';

/** Una tasa diaria tal como la expone el microservicio tasas-bcv. */
export interface TasaDiaria {
  cur_cod: string; // USD | EUR
  valid_from: string; // YYYY-MM-DD
  rat_exc: string; // decimal como string
}

export interface TasasDia {
  fecha: string;
  USD: TasaDiaria | null;
  EUR: TasaDiaria | null;
  fuente?: 'microservicio' | 'cache'; // de dónde salieron (trazabilidad)
}

/**
 * Cliente del microservicio externo tasas-bcv (USD/EUR ↔ Bs). El backend solo consume.
 * Si el micro no responde, cae a la última tasa conocida persistida en TasaCache (RN-117);
 * no bloquea la operación. La tasa usada se guarda por documento en el Facturador (RN-118).
 */
@Injectable()
export class TasasService {
  private readonly logger = new Logger(TasasService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Últimas tasas (la fecha más reciente con datos). */
  async ultimas(): Promise<TasasDia> {
    try {
      const data = this.config.get<boolean>('tasasBcv.mock')
        ? this.mock()
        : await this.get<TasasDia>('/api/tasas/ultimas');
      await this.persistir(data);
      return { ...data, fuente: 'microservicio' };
    } catch (e) {
      this.logger.warn(`tasas-bcv no disponible; usando última tasa conocida (${(e as Error).message})`);
      return this.desdeCache();
    }
  }

  /** Tasas de una fecha concreta (YYYY-MM-DD). */
  async porFecha(fecha: string): Promise<TasasDia> {
    if (this.config.get<boolean>('tasasBcv.mock')) {
      return { ...this.mock(fecha), fuente: 'microservicio' };
    }
    const data = await this.get<TasasDia>(`/api/tasas/fecha/${fecha}`);
    await this.persistir(data);
    return { ...data, fuente: 'microservicio' };
  }

  /** Devuelve la tasa vigente de una moneda como número (para cálculos). */
  async obtenerTasa(moneda: 'USD' | 'EUR' = 'USD'): Promise<Decimal | null> {
    const t = (await this.ultimas())[moneda];
    return t ? new Decimal(t.rat_exc) : null;
  }

  private async get<T>(ruta: string): Promise<T> {
    const base = this.config.get<string>('tasasBcv.baseUrl');
    const timeoutMs = this.config.get<number>('tasasBcv.timeoutMs') ?? 6000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${ruta}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`tasas-bcv respondió ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Persiste las tasas recibidas como última tasa conocida (fallback futuro). */
  private async persistir(data: TasasDia) {
    for (const t of [data.USD, data.EUR]) {
      if (!t) continue;
      await this.prisma.tasaCache.upsert({
        where: { curCod_validFrom: { curCod: t.cur_cod, validFrom: new Date(t.valid_from) } },
        update: { ratExc: t.rat_exc },
        create: { curCod: t.cur_cod, validFrom: new Date(t.valid_from), ratExc: t.rat_exc },
      });
    }
  }

  /** Última tasa conocida desde la caché local (RN-117). */
  private async desdeCache(): Promise<TasasDia> {
    const [usd, eur] = await Promise.all([
      this.prisma.tasaCache.findFirst({ where: { curCod: 'USD' }, orderBy: { validFrom: 'desc' } }),
      this.prisma.tasaCache.findFirst({ where: { curCod: 'EUR' }, orderBy: { validFrom: 'desc' } }),
    ]);
    if (!usd && !eur) {
      throw new ServiceUnavailableException('No hay tasa disponible (microservicio caído y sin caché)');
    }
    const map = (t: typeof usd): TasaDiaria | null =>
      t ? { cur_cod: t.curCod, valid_from: t.validFrom.toISOString().slice(0, 10), rat_exc: t.ratExc.toString() } : null;
    const fecha = (usd ?? eur)!.validFrom.toISOString().slice(0, 10);
    return { fecha, USD: map(usd), EUR: map(eur), fuente: 'cache' };
  }

  /** Tasas simuladas para desarrollo (sin micro). */
  private mock(fecha?: string): TasasDia {
    const f = fecha ?? new Date().toISOString().slice(0, 10);
    return {
      fecha: f,
      USD: { cur_cod: 'USD', valid_from: f, rat_exc: '523.675000' },
      EUR: { cur_cod: 'EUR', valid_from: f, rat_exc: '598.120000' },
    };
  }
}
