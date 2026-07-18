import { MetodoPago } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Cuenta contable (evento) por método de pago (RN-107 / tabla del Facturador en el SDD).
 * Cada método golpea una cuenta distinta; el pago mixto reparte cada parte a la suya.
 * Nombres de evento provisionales hasta la tabla definitiva del contador.
 */
export const EVENTO_PAGO: Record<MetodoPago, string> = {
  EFECTIVO_BS: 'caja_efectivo', // 1.1.1.01 Caja
  DIVISAS: 'caja_divisas', // 1.1.1.03 Caja Divisas
  PAGO_MOVIL: 'banco_pago_movil', // 1.1.2.01 Bancos
  TARJETA: 'cxc_pos', // 1.1.2.02 CxC POS
};

export interface LineaAsientoVenta {
  evento: string;
  debe?: Decimal.Value;
  haber?: Decimal.Value;
}

/**
 * Líneas del asiento de una venta (RN-107). Una línea al debe por cada pago (cuenta según
 * el método); al haber el IGTF por pagar, el ingreso y el IVA débito. Los pagos YA suman
 * total + IGTF (el cliente cubre el 3%), así que el efectivo/divisa recibido incluye el
 * IGTF y NO se agrega una línea de caja extra por él (si no, el asiento se descuadra).
 * Lógica PURA para poder probar el cuadre sin base de datos.
 */
export function construirLineasAsientoVenta(doc: {
  subtotal: Decimal.Value;
  totalTax: Decimal.Value;
  igtf: Decimal.Value;
  pagos: { metodo: MetodoPago; monto: Decimal.Value }[];
}): LineaAsientoVenta[] {
  const lineas: LineaAsientoVenta[] = [];
  for (const p of doc.pagos) {
    lineas.push({ evento: EVENTO_PAGO[p.metodo], debe: p.monto });
  }
  if (new Decimal(doc.igtf).gt(0)) {
    lineas.push({ evento: 'igtf', haber: doc.igtf });
  }
  lineas.push({ evento: 'venta_ingreso', haber: doc.subtotal });
  lineas.push({ evento: 'iva_debito', haber: doc.totalTax });
  return lineas;
}
