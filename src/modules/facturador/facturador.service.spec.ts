import Decimal from 'decimal.js';
import { MetodoPago } from '@prisma/client';
import { construirLineasAsientoVenta } from './facturador.service';

function totales(lineas: ReturnType<typeof construirLineasAsientoVenta>) {
  const debe = lineas.reduce((acc, l) => acc.plus(l.debe ?? 0), new Decimal(0));
  const haber = lineas.reduce((acc, l) => acc.plus(l.haber ?? 0), new Decimal(0));
  return { debe, haber };
}

describe('construirLineasAsientoVenta', () => {
  it('cuadra en una venta en efectivo (sin IGTF)', () => {
    const lineas = construirLineasAsientoVenta({
      subtotal: new Decimal('100.00'),
      totalTax: new Decimal('16.00'),
      igtf: new Decimal('0.00'),
      pagos: [{ metodo: MetodoPago.EFECTIVO_BS, monto: new Decimal('116.00') }],
    });
    const { debe, haber } = totales(lineas);
    expect(debe.equals(haber)).toBe(true);
    expect(lineas.some((l) => l.evento === 'igtf')).toBe(false);
  });

  // Caso que reprodujo el bug: el pago en divisas ya trae el 3% de IGTF sumado
  // (RN-010, validado en emitirFactura); duplicar el IGTF al debe descuadraba
  // el asiento y registrarAutomatico lo descartaba en silencio.
  it('cuadra en una venta con pago en divisas (con IGTF)', () => {
    const lineas = construirLineasAsientoVenta({
      subtotal: new Decimal('100.00'),
      totalTax: new Decimal('16.00'),
      igtf: new Decimal('3.48'), // 3% de 116.00
      pagos: [{ metodo: MetodoPago.DIVISAS, monto: new Decimal('119.48') }],
    });
    const { debe, haber } = totales(lineas);
    expect(debe.equals(haber)).toBe(true);
    expect(haber.toFixed(2)).toBe('119.48');
  });

  it('cuadra en un pago mixto (efectivo + divisas) con IGTF', () => {
    const lineas = construirLineasAsientoVenta({
      subtotal: new Decimal('200.00'),
      totalTax: new Decimal('32.00'),
      igtf: new Decimal('1.50'), // 3% de 50.00 en divisas
      pagos: [
        { metodo: MetodoPago.EFECTIVO_BS, monto: new Decimal('182.00') },
        { metodo: MetodoPago.DIVISAS, monto: new Decimal('51.50') },
      ],
    });
    const { debe, haber } = totales(lineas);
    expect(debe.equals(haber)).toBe(true);
    // Compara cada línea exacta (evento, lado, monto), no solo el total:
    // dos errores que se cancelen entre sí (ej. debe y haber inflados por
    // igual) pasarían el check de arriba sin que este lo detecte.
    expect(lineas.map((l) => [l.evento, l.debe ? 'debe' : 'haber', (l.debe ?? l.haber)!.toString()])).toEqual([
      ['caja_efectivo', 'debe', '182'],
      ['caja_divisas', 'debe', '51.5'],
      ['venta_ingreso', 'haber', '200'],
      ['iva_debito', 'haber', '32'],
      ['igtf', 'haber', '1.5'],
    ]);
  });
});
