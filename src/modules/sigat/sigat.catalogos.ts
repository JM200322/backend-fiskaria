/**
 * Catálogos estáticos de SIGAT: traducen los IDs numéricos que devuelve el API
 * (métodos de pago, tributos habilitados) a nombres legibles. Fuente de verdad
 * única — el frontend consume el `{ id, nombre }` ya resuelto, no los códigos.
 *
 * Son datos de referencia estables (no cambian por request): un mapa congelado
 * es suficiente, sin tabla en BD. Si SIGAT agrega un código que aún no está aquí,
 * `resolverCatalogo` degrada a "Código N" en vez de perder o romper el dato.
 */
import { SigatCatalogoItem } from './sigat.types';

/** Métodos de pago aceptados por una alcaldía (campo `metodosPago`). */
export const METODOS_PAGO: Readonly<Record<number, string>> = Object.freeze({
  1: 'Pago en línea',
  2: 'Transferencia',
  3: 'Punto de venta',
  4: 'Pago móvil',
  5: 'Efectivo',
  6: 'Retención',
  7: 'Crédito fiscal',
  8: 'Migración de crédito fiscal',
  9: 'Banca por internet',
  10: 'Pago ONT',
  11: 'Pago ONT órgano',
  12: 'Percepción',
});

/** Tributos / actividades económicas habilitables en una alcaldía (`habilitadas`). */
export const ACTIVIDADES_ECONOMICAS: Readonly<Record<number, string>> = Object.freeze({
  1: 'Actividades Económicas',
  2: 'Inmuebles Urbanos',
  3: 'Vehículos',
  4: 'Publicidad Comercial',
  5: 'Espectáculos Públicos',
  6: 'Comercio Internacional',
  7: 'Tasas',
  8: 'Transporte de carga',
  9: 'Control Urbano',
  10: 'Servicio de Aseo',
  11: 'Timbres Fiscales',
  12: 'Juegos y apuestas lícitas',
  13: 'Convivencia Ciudadana',
  14: 'Relleno sanitario',
  15: 'Servicio de gas',
  16: 'Contribución de Aseo',
  17: 'Contribución de Gas',
  18: 'Otros ingresos',
  19: 'Ambiental',
});

/**
 * Resuelve una lista de IDs contra un catálogo. Los códigos desconocidos no se
 * descartan: se etiquetan "Código N" para no ocultar datos que SIGAT sí habilitó.
 */
export function resolverCatalogo(
  catalogo: Readonly<Record<number, string>>,
  ids: readonly number[] | undefined,
): SigatCatalogoItem[] {
  return (ids ?? []).map((id) => ({ id, nombre: catalogo[id] ?? `Código ${id}` }));
}
