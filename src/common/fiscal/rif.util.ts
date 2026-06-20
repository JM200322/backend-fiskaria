/**
 * Utilidades de RIF venezolano (compartidas — base de `fiscal-utils`).
 * El validador del SENIAT acepta el RIF con o sin guiones; aquí normalizamos
 * y validamos el formato básico antes de llamar a la API.
 */

/** Letras de tipo de RIF/identidad válidas en Venezuela. */
const TIPOS_RIF = ['V', 'E', 'J', 'P', 'G', 'C'] as const;

/** Normaliza un RIF: mayúsculas, sin espacios ni guiones. Ej. "j-12345678-9" → "J123456789". */
export function normalizarRif(rif: string): string {
  return (rif ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Valida el formato del RIF: una letra de tipo seguida de 8 a 10 dígitos.
 * No valida existencia (eso lo hace la API del SENIAT) ni dígito verificador.
 */
export function esRifFormatoValido(rif: string): boolean {
  const n = normalizarRif(rif);
  const tipo = n.charAt(0) as (typeof TIPOS_RIF)[number];
  if (!TIPOS_RIF.includes(tipo)) return false;
  const digitos = n.slice(1);
  return /^\d{8,10}$/.test(digitos);
}

/** Formatea un RIF normalizado con guiones: "J123456789" → "J-12345678-9". */
export function formatearRif(rif: string): string {
  const n = normalizarRif(rif);
  if (!esRifFormatoValido(n)) return n;
  const tipo = n.charAt(0);
  const cuerpo = n.slice(1, -1);
  const verificador = n.slice(-1);
  return `${tipo}-${cuerpo}-${verificador}`;
}
