import Decimal from 'decimal.js';

/**
 * Cálculos fiscales (parte de `fiscal-utils`). Lógica PURA y testeable.
 *
 * Convenciones (ver SDD: RN-009 alícuotas, RN-010 IGTF, RN-109 factura en Bs):
 * - Montos en Bs con 2 decimales; se usa decimal.js (NUNCA float) para evitar errores.
 * - El IVA se calcula **agrupando por alícuota** (base imponible por alícuota), redondeando
 *   el IVA por grupo. Es el desglose que exige la factura SENIAT y reproduce los totales del
 *   API de la imprenta. (Decisión de implementación: el SDD no fija "por línea vs por total".)
 * - El precio del producto es **base imponible** (sin IVA); el IVA se suma encima.
 */

/** Tasa del IGTF sobre pagos en divisas (RN-010). */
export const IGTF_TASA = 3;

export interface LineaCalculo {
  cantidad: Decimal.Value;
  precioUnitario: Decimal.Value;
  /** Alícuota de IVA en porcentaje (0 para exento/exonerado). */
  alicuota: Decimal.Value;
}

export interface DesgloseAlicuota {
  alicuota: string; // ej. "16"
  base: string; // base imponible de esa alícuota
  iva: string;
}

export interface ResultadoCalculo {
  subtotal: string; // suma de bases (sin IVA)
  totalIva: string;
  total: string; // subtotal + IVA (sin IGTF)
  desglose: DesgloseAlicuota[];
}

/** Redondea a `decimales` (por defecto 2) con redondeo half-up. */
export function redondear(valor: Decimal.Value, decimales = 2): Decimal {
  return new Decimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP);
}

/** Base imponible de una línea: cantidad × precio unitario (redondeada a 2). */
export function calcularBaseLinea(cantidad: Decimal.Value, precioUnitario: Decimal.Value): Decimal {
  return redondear(new Decimal(cantidad).times(precioUnitario));
}

/**
 * Calcula el documento a partir de sus líneas: subtotal, IVA por alícuota y total.
 */
export function calcularDocumento(lineas: LineaCalculo[]): ResultadoCalculo {
  // Acumula la base imponible por alícuota.
  const basesPorAlicuota = new Map<string, Decimal>();
  let subtotal = new Decimal(0);

  for (const linea of lineas) {
    const base = calcularBaseLinea(linea.cantidad, linea.precioUnitario);
    subtotal = subtotal.plus(base);
    const key = new Decimal(linea.alicuota).toString();
    basesPorAlicuota.set(key, (basesPorAlicuota.get(key) ?? new Decimal(0)).plus(base));
  }

  const desglose: DesgloseAlicuota[] = [];
  let totalIva = new Decimal(0);

  // Orden estable por alícuota ascendente.
  const alicuotas = [...basesPorAlicuota.keys()].sort((a, b) => new Decimal(a).comparedTo(b));
  for (const alic of alicuotas) {
    const base = redondear(basesPorAlicuota.get(alic) as Decimal);
    const iva = redondear(base.times(alic).dividedBy(100));
    totalIva = totalIva.plus(iva);
    desglose.push({ alicuota: alic, base: base.toFixed(2), iva: iva.toFixed(2) });
  }

  subtotal = redondear(subtotal);
  const total = redondear(subtotal.plus(totalIva));

  return {
    subtotal: subtotal.toFixed(2),
    totalIva: redondear(totalIva).toFixed(2),
    total: total.toFixed(2),
    desglose,
  };
}

/** IGTF (3% por defecto) sobre el monto pagado en divisas (RN-010). */
export function calcularIgtf(montoEnDivisas: Decimal.Value, tasa: Decimal.Value = IGTF_TASA): string {
  return redondear(new Decimal(montoEnDivisas).times(tasa).dividedBy(100)).toFixed(2);
}
