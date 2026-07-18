import Decimal from 'decimal.js';
import { construirLineasAsientoVenta, EVENTO_PAGO, LineaAsientoVenta } from './asiento-venta';

const suma = (lineas: LineaAsientoVenta[], lado: 'debe' | 'haber') =>
  lineas.reduce((s, l) => s.plus(new Decimal(l[lado] ?? 0)), new Decimal(0));

const cuadra = (lineas: LineaAsientoVenta[]) =>
  suma(lineas, 'debe').equals(suma(lineas, 'haber'));

describe('construirLineasAsientoVenta', () => {
  it('venta en efectivo (sin IGTF) cuadra', () => {
    // total 290 (subtotal 250 + IVA 40), pagado 290 en efectivo
    const lineas = construirLineasAsientoVenta({
      subtotal: 250,
      totalTax: 40,
      igtf: 0,
      pagos: [{ metodo: 'EFECTIVO_BS', monto: 290 }],
    });
    expect(cuadra(lineas)).toBe(true);
    expect(suma(lineas, 'debe').toFixed(2)).toBe('290.00');
    // sin IGTF no hay línea de igtf
    expect(lineas.some((l) => l.evento === 'igtf')).toBe(false);
  });

  it('pago mixto reparte cada método a su cuenta', () => {
    const lineas = construirLineasAsientoVenta({
      subtotal: 250,
      totalTax: 40,
      igtf: 0,
      pagos: [
        { metodo: 'EFECTIVO_BS', monto: 200 },
        { metodo: 'PAGO_MOVIL', monto: 90 },
      ],
    });
    expect(cuadra(lineas)).toBe(true);
    expect(lineas).toContainEqual({ evento: EVENTO_PAGO.EFECTIVO_BS, debe: 200 });
    expect(lineas).toContainEqual({ evento: EVENTO_PAGO.PAGO_MOVIL, debe: 90 });
  });

  it('REGRESIÓN: venta con divisas + IGTF cuadra y NO duplica el IGTF al debe', () => {
    // Los pagos suman total + IGTF = 293 (290 + 3). subtotal 250, IVA 40, IGTF 3.
    const lineas = construirLineasAsientoVenta({
      subtotal: 250,
      totalTax: 40,
      igtf: 3,
      pagos: [
        { metodo: 'DIVISAS', monto: 100 },
        { metodo: 'EFECTIVO_BS', monto: 193 },
      ],
    });
    expect(suma(lineas, 'debe').toFixed(2)).toBe('293.00');
    expect(suma(lineas, 'haber').toFixed(2)).toBe('293.00');
    expect(cuadra(lineas)).toBe(true);
    // solo 2 líneas al debe (los 2 pagos): NO hay una línea de caja extra por el IGTF
    expect(lineas.filter((l) => l.debe !== undefined)).toHaveLength(2);
    // el IGTF va una sola vez, al haber
    expect(lineas.filter((l) => l.evento === 'igtf')).toEqual([{ evento: 'igtf', haber: 3 }]);
  });

  it('siempre incluye ingreso (subtotal) e IVA débito al haber', () => {
    const lineas = construirLineasAsientoVenta({
      subtotal: 250,
      totalTax: 40,
      igtf: 0,
      pagos: [{ metodo: 'TARJETA', monto: 290 }],
    });
    expect(lineas).toContainEqual({ evento: 'venta_ingreso', haber: 250 });
    expect(lineas).toContainEqual({ evento: 'iva_debito', haber: 40 });
  });
});
