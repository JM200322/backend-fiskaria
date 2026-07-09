import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Datos de un producto tal como los expone Open Food Facts, ya normalizados. */
export interface SugerenciaOpenFoodFacts {
  codigoBarras: string;
  nombre: string;
  marca?: string;
  imagenUrl?: string;
  cantidad?: string;
}

interface OffProductoRaw {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    image_front_url?: string;
    quantity?: string;
  };
}

const RATE_LIMIT = 15; // consultas/min que Open Food Facts permite por IP (GET /product)
const RATE_WINDOW_MS = 60_000;

/**
 * Cliente de Open Food Facts (catálogo público de productos). Solo lectura.
 * El límite de 15 req/min es por IP saliente del backend (no por usuario de
 * Fiskaria), así que el contador es un único bucket en memoria compartido por
 * todo el proceso — no por request.
 */
@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private llamadasRecientes: number[] = [];

  constructor(private readonly config: ConfigService) {}

  /** `null` si no existe en OFF, si se agotó el rate limit, o si la API no responde a tiempo. */
  async buscarPorCodigoBarras(codigoBarras: string): Promise<SugerenciaOpenFoodFacts | null> {
    if (!this.reservarCupo()) {
      this.logger.warn('Límite de consultas a Open Food Facts alcanzado (15/min)');
      return null;
    }

    const base = this.config.get<string>('openFoodFacts.baseUrl');
    const userAgent = this.config.get<string>('openFoodFacts.userAgent');
    const timeoutMs = this.config.get<number>('openFoodFacts.timeoutMs') ?? 6000;
    const fields = 'product_name,brands,image_front_url,quantity';
    const url = `${base}/api/v2/product/${encodeURIComponent(codigoBarras)}.json?fields=${fields}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': userAgent! },
      });
      if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
      const data = (await res.json()) as OffProductoRaw;
      if (data.status !== 1 || !data.product?.product_name) return null;
      return {
        codigoBarras,
        nombre: data.product.product_name,
        marca: data.product.brands || undefined,
        imagenUrl: data.product.image_front_url || undefined,
        cantidad: data.product.quantity || undefined,
      };
    } catch (e) {
      this.logger.warn(`Open Food Facts no disponible: ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ventana deslizante simple: purga llamadas fuera de la ventana y reserva un cupo. */
  private reservarCupo(): boolean {
    const ahora = Date.now();
    this.llamadasRecientes = this.llamadasRecientes.filter((t) => ahora - t < RATE_WINDOW_MS);
    if (this.llamadasRecientes.length >= RATE_LIMIT) return false;
    this.llamadasRecientes.push(ahora);
    return true;
  }
}
