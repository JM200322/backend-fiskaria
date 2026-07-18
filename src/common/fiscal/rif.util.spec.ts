import { esRifFormatoValido, formatearRif, normalizarRif } from './rif.util';

describe('rif.util', () => {
  describe('normalizarRif', () => {
    it('quita guiones y espacios, pasa a mayúsculas', () => {
      expect(normalizarRif('j-12345678-9')).toBe('J123456789');
      expect(normalizarRif('  v 12345678 ')).toBe('V12345678');
    });

    it('maneja cadena vacía o nula', () => {
      expect(normalizarRif('')).toBe('');
      expect(normalizarRif(undefined as unknown as string)).toBe('');
    });
  });

  describe('esRifFormatoValido', () => {
    it('acepta tipos válidos (V/E/J/P/G/C) con 8-10 dígitos', () => {
      expect(esRifFormatoValido('V-12345678-9')).toBe(true);
      expect(esRifFormatoValido('J123456789')).toBe(true);
      expect(esRifFormatoValido('E12345678')).toBe(true);
      expect(esRifFormatoValido('G200000000')).toBe(true);
    });

    it('rechaza tipo inválido', () => {
      expect(esRifFormatoValido('X123456789')).toBe(false);
      expect(esRifFormatoValido('123456789')).toBe(false);
    });

    it('rechaza cantidad de dígitos fuera de rango', () => {
      expect(esRifFormatoValido('V1234567')).toBe(false); // 7 dígitos
      expect(esRifFormatoValido('V12345678901')).toBe(false); // 11 dígitos
    });

    it('rechaza caracteres no numéricos en el cuerpo', () => {
      expect(esRifFormatoValido('V1234567A')).toBe(false);
    });
  });

  describe('formatearRif', () => {
    it('agrega guiones a un RIF válido', () => {
      expect(formatearRif('J123456789')).toBe('J-12345678-9');
      expect(formatearRif('v-12345678-9')).toBe('V-12345678-9');
    });

    it('devuelve el normalizado si no es válido', () => {
      expect(formatearRif('X123')).toBe('X123');
    });
  });
});
