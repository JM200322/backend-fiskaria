/**
 * Tipos de la integración con SIGAT (API Terceros — sistema municipal tributario).
 *
 * Dos capas:
 *  - Dominio interno (`Sigat*`): lo que Fiskaria expone y consume. Estable.
 *  - Shapes crudos (`SigatRaw*`): la forma literal del API externo. Solo viven
 *    dentro del adaptador (SigatService); el resto del sistema no los conoce.
 */

/** Error del adaptador SIGAT (capa anticorrupción). Nunca filtra detalles crudos. */
export class SigatError extends Error {
  constructor(
    message: string,
    readonly codigo?: number,
  ) {
    super(message);
    this.name = 'SigatError';
  }
}

// ── Dominio interno ─────────────────────────────────────────────────────────

/** Ítem de catálogo ya resuelto: id crudo del API + nombre legible. */
export interface SigatCatalogoItem {
  id: number;
  nombre: string;
}

export interface SigatAlcaldia {
  id: number;
  nombre: string;
}

export interface SigatContribuyente {
  id: number;
  rif: string;
  razonSocial: string;
  domicilioFiscal: string | null;
  verificado: boolean;
  alcaldias: SigatAlcaldia[];
}

export interface SigatConsolidadoAlcaldia {
  alcaldia: { id: number; nombre: string; siglas: string | null; activa: boolean };
  metodosPago: SigatCatalogoItem[];
  transferencias: { rif: string; beneficiario: string; instrucciones: string } | null;
}

export interface SigatLicenciaResumen {
  id: number;
  numero: string;
  tipo: number | null;
  fechaEmision: string | null;
  fechaVigenciaHasta: string | null;
  codigoCatastral: string | null;
}

export interface SigatObligaciones {
  habilitadas: SigatCatalogoItem[];
  versiones: Record<string, number>[];
  licencias: SigatLicenciaResumen[];
}

export interface SigatLicenciaActiva {
  id: number;
  numero: string;
  alcaldiaId: number | null;
  fechaVigenciaDesde: string | null;
  fechaVigenciaHasta: string | null;
  areaEstablecimiento: number | null;
  horarioEstablecimiento: string | null;
}

/** Detalle de una licencia (subconjunto útil; el API crudo trae 50+ campos internos). */
export interface SigatLicenciaDetalle {
  id: number;
  numero: string;
  tipo: number | null;
  codigoCatastral: string | null;
  fechaEmision: string | null;
  fechaRenovacion: string | null;
  fechaVigenciaDesde: string | null;
  fechaVigenciaHasta: string | null;
  areaEstablecimiento: number | null;
  horarioEstablecimiento: string | null;
  telefonoEstablecimiento: string | null;
  direccion: string | null;
  cantidadEmpleados: number | null;
  alcaldia: { id: number; nombre: string; siglas: string | null } | null;
  vencida: boolean | null;
  renovable: boolean | null;
  urlDocumento: string | null;
}

export interface SigatTipoVehiculo {
  id: number;
  categoria: number;
  descripcion: string;
}

export interface SigatVehiculo {
  id: number;
  contribuyente: { id: number; rif: string; razonSocial: string } | null;
  alcaldia: SigatAlcaldia | null;
  tipo: SigatTipoVehiculo | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  placa: string | null;
}

export interface SigatDocumento {
  campo: string;
  url: string;
}

export type SigatEstadoConexion = 'connected' | 'mock' | 'degraded' | 'offline' | 'unconfigured';

export interface SigatEstado {
  estado: SigatEstadoConexion;
  mock: boolean;
  mensaje: string;
  verificadoEn: string;
  latenciaMs?: number;
}

// ── Shapes crudos del API (uso interno del adaptador) ───────────────────────

export interface SigatRawContribuyente {
  id: number;
  rif: string;
  razonSocial: string;
  domicilioFiscal?: string | null;
  verificado?: boolean;
  usuario?: { id: number; correo: string; telefono?: string } | null;
  alcaldias?: { id: number; nombre: string }[];
}

export interface SigatRawConsolidadoItem {
  informacionBancaria?: {
    alcaldia?: { id: number; nombre: string; siglas?: string | null; activa?: boolean };
    metodosPago?: number[];
    transferencias?: { rif?: string; beneficiario?: string; instrucciones?: string };
  };
}

export interface SigatRawObligaciones {
  habilitadas?: number[];
  versiones?: Record<string, number>[];
  licencias?: {
    id: number;
    numero: string;
    tipo?: number;
    fechaEmision?: string;
    fechaVigenciaHasta?: string;
    codigoCatastral?: string;
  }[];
}

export interface SigatRawLicenciaActivaItem {
  licencia?: {
    id: number;
    numero: string;
    alcaldia?: { id: number };
    fechaVigenciaDesde?: string;
    fechaVigenciaHasta?: string;
    areaEstablecimiento?: number | string;
    horarioEstablecimiento?: string;
  };
}

export interface SigatRawLicenciaDetalle {
  licencia?: {
    id: number;
    numero: string;
    tipo?: number;
    codigoCatastral?: string;
    fechaEmision?: string;
    fechaRenovacion?: string;
    fechaVigenciaDesde?: string;
    fechaVigenciaHasta?: string;
    areaEstablecimiento?: number | string;
    horarioEstablecimiento?: string;
    telefonoEstablecimiento?: string;
    direccion?: string;
    cantidadEmpleados?: number;
    alcaldia?: { id: number; nombre: string; siglas?: string };
    vencida?: boolean;
    renovable?: boolean;
  };
  urlDocumento?: string;
}

export interface SigatRawVehiculo {
  id: number;
  contribuyente?: { id: number; rif: string; razonSocial: string };
  alcaldia?: { id: number; nombre: string };
  tipo?: { id: number; categoria: number; descripcion: string };
  marca?: string;
  modelo?: string;
  ano?: number;
  placa?: string;
}

/** Forma de los errores del API: { uuid, fechaHora, codigo, mensaje }. */
export interface SigatRawError {
  uuid?: string;
  fechaHora?: string;
  codigo?: number;
  mensaje?: string;
}
