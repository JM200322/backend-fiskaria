import {
  calcularBaseLinea,
  calcularDocumento,
  calcularIgtf,
  redondear,
} from './calculo-fiscal';

describe('calculo-fiscal', () => {
  describe('redondear', () => {
    it('redondea a 2 decimales half-up', () => {
      expect(redondear(3041.8736).toFixed(2)).toBe('3041.87');
      expect(redondear(1.005).toFixed(2)).toBe('1.01');
      expect(redondear(2.675).toFixed(2)).toBe('2.68'); // caso clásico que falla con float
    });
  });

  describe('calcularBaseLinea', () => {
    it('multiplica cantidad por precio', () => {
      expect(calcularBaseLinea(3, 6093.43).toFixed(2)).toBe('18280.29');
      expect(calcularBaseLinea(1, 731.42).toFixed(2)).toBe('731.42');
    });
  });

  describe('calcularDocumento', () => {
    it('reproduce el ejemplo del API de la imprenta (2 líneas al 16%)', () => {
      // Payload de referencia: subtotal 19011.71, total_tax 3041.87, total 22053.58
      const r = calcularDocumento([
        { cantidad: 1, precioUnitario: 731.42, alicuota: 16 },
        { cantidad: 3, precioUnitario: 6093.43, alicuota: 16 },
      ]);
      expect(r.subtotal).toBe('19011.71');
      expect(r.totalIva).toBe('3041.87');
      expect(r.total).toBe('22053.58');
      expect(r.desglose).toHaveLength(1);
      expect(r.desglose[0]).toEqual({ alicuota: '16', base: '19011.71', iva: '3041.87' });
    });

    it('agrupa el IVA por alícuota (mixto 16% + exento + 8%)', () => {
      const r = calcularDocumento([
        { cantidad: 2, precioUnitario: 100, alicuota: 16 }, // base 200
        { cantidad: 1, precioUnitario: 50, alicuota: 0 }, // exento 50
        { cantidad: 4, precioUnitario: 25, alicuota: 8 }, // base 100
      ]);
      expect(r.subtotal).toBe('350.00');
      // IVA: 200*16% = 32.00 ; 100*8% = 8.00 ; exento 0
      expect(r.totalIva).toBe('40.00');
      expect(r.total).toBe('390.00');
      expect(r.desglose).toEqual([
        { alicuota: '0', base: '50.00', iva: '0.00' },
        { alicuota: '8', base: '100.00', iva: '8.00' },
        { alicuota: '16', base: '200.00', iva: '32.00' },
      ]);
    });

    it('maneja documento vacío', () => {
      const r = calcularDocumento([]);
      expect(r).toEqual({ subtotal: '0.00', totalIva: '0.00', total: '0.00', desglose: [] });
    });
  });

  describe('calcularIgtf', () => {
    it('aplica 3% por defecto sobre el monto en divisas', () => {
      expect(calcularIgtf(100)).toBe('3.00');
      expect(calcularIgtf(22053.58)).toBe('661.61'); // 3% de 22053.58 = 661.6074
    });

    it('permite una tasa distinta', () => {
      expect(calcularIgtf(100, 5)).toBe('5.00');
    });
  });
});
