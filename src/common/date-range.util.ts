import { Prisma } from '@prisma/client';

/**
 * Filtro de rango sobre un campo `DateTime` (día del documento/registro).
 * `hasta` es inclusivo hasta fin del día cuando se pasa solo fecha (sin hora).
 * Compartido por los `listar()` que aceptan `desde`/`hasta` (Facturador, Compras).
 */
export function rangoFecha(desde?: string, hasta?: string): Prisma.DateTimeFilter | undefined {
  if (!desde && !hasta) return undefined;
  const filtro: Prisma.DateTimeFilter = {};
  if (desde) filtro.gte = new Date(desde);
  if (hasta) {
    const h = new Date(hasta);
    if (/^\d{4}-\d{2}-\d{2}$/.test(hasta)) h.setUTCHours(23, 59, 59, 999); // solo fecha → todo el día
    filtro.lte = h;
  }
  return filtro;
}

/** Clamp de paginación: limit 1-200 (default 100), offset >= 0 (default 0). */
export function paginacion(limit?: number, offset?: number): { take: number; skip: number } {
  const take = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit!), 1), 200) : 100;
  const skip = Number.isFinite(offset) ? Math.max(Math.trunc(offset!), 0) : 0;
  return { take, skip };
}
