import { formatearFechaImprenta, mapearPaymentMethodImprenta } from './factura.mapper';

describe('factura.mapper', () => {
  describe('mapearPaymentMethodImprenta', () => {
    it('traduce nuestras etiquetas a los valores válidos de la API', () => {
      expect(mapearPaymentMethodImprenta('Efectivo Bs.')).toBe('Efectivo');
      expect(mapearPaymentMethodImprenta('Pago Móvil')).toBe('Pago Movil');
      expect(mapearPaymentMethodImprenta('Tarjeta')).toBe('Tarjeta Debito');
    });

    it('Divisas y Mixto (no soportados por la API) caen a Efectivo', () => {
      expect(mapearPaymentMethodImprenta('Divisas')).toBe('Efectivo');
      expect(mapearPaymentMethodImprenta('Mixto')).toBe('Efectivo');
    });

    it('valor desconocido usa Efectivo por defecto', () => {
      expect(mapearPaymentMethodImprenta('cualquier-cosa')).toBe('Efectivo');
    });
  });

  describe('formatearFechaImprenta', () => {
    it('formatea a DD-MM-YYYY en UTC', () => {
      expect(formatearFechaImprenta(new Date('2026-07-09T15:00:00Z'))).toBe('09-07-2026');
      expect(formatearFechaImprenta(new Date('2026-12-01T00:00:00Z'))).toBe('01-12-2026');
    });
  });
});
