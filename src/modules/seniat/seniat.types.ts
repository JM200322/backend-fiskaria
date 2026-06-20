/** Resultado de la validación de un contribuyente ante el SENIAT (RN-101). */
export interface ResultadoValidacionSeniat {
  rif: string;
  nombreCompleto: string;
  tipoContribuyente: string; // "Ordinario" | "Especial" | "Formal"
}

export type SeniatErrorCode = 'RIF_INVALIDO' | 'NO_ENCONTRADO' | 'NO_DISPONIBLE';

/** Error tipado del validador, para que la capa de negocio decida la respuesta HTTP. */
export class SeniatValidationError extends Error {
  constructor(
    public readonly code: SeniatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SeniatValidationError';
  }
}
