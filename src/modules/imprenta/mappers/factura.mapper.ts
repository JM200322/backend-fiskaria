import { ImprentaFacturaPayload } from '../imprenta.types';

/** Datos de factura en términos del dominio (nombres limpios). El mapper los traduce. */
export interface DatosFacturaImprenta {
  docNum: string;
  cliente: {
    nombre: string;
    tipoId: string;
    idNum: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
  };
  fecha: Date;
  hora: string; // HH:MM:SS
  paymentMethod: string;
  notificarCliente: boolean;
  subtotal: number;
  totalTax: number;
  totalWTaxes: number;
  igtf: number;
  tasaBcv: number;
  items: {
    descripcion: string;
    codigo: string;
    cantidad: number;
    costoUnit: number;
    costoTotal: number;
    taxElm: string; // "G" | "E"
    taxPercentage: string; // "16%"
  }[];
  /** Si viene, la factura es a terceros (FACTURA_TERCEROS, RN-126). */
  tercero?: {
    nombre: string;
    tipoId: string;
    idNum: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
  } | null;
}

/** Fecha a formato del API de la imprenta: DD-MM-YYYY. */
export function formatearFechaImprenta(fecha: Date): string {
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const y = fecha.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

/** Construye el payload de `POST /generateBill` con los nombres exactos del API. */
export function construirPayloadFactura(datos: DatosFacturaImprenta): ImprentaFacturaPayload {
  const t = datos.tercero;
  return {
    type: t ? 'FACTURA_TERCEROS' : 'FACTURA',
    client_full_name: datos.cliente.nombre,
    doc_num: datos.docNum,
    client_type_id: datos.cliente.tipoId,
    client_id_num: datos.cliente.idNum,
    client_address: datos.cliente.direccion ?? '',
    client_phone: datos.cliente.telefono ?? '',
    client_email: datos.cliente.email ?? '',
    emition_date: formatearFechaImprenta(datos.fecha),
    emition_hour: datos.hora,
    payment_method: datos.paymentMethod,
    currency: 'VES',
    notify_client: datos.notificarCliente ? '1' : '0',
    subtotal: datos.subtotal,
    total_w_taxes: datos.totalWTaxes,
    total_tax: datos.totalTax,
    igtf: datos.igtf,
    tasa_bcv: datos.tasaBcv,
    bill_items: datos.items.map((it) => ({
      type: 'item',
      description_elm_fac: it.descripcion,
      code_elm_fac: it.codigo,
      num_elm_fac: it.cantidad,
      cost_unit_elm_fac: it.costoUnit,
      cost_total_elm_fac: it.costoTotal,
      tax_elm_fac: it.taxElm,
      tax_percentage: it.taxPercentage,
    })),
    ...(t
      ? {
          third_party_full_name: t.nombre,
          third_party_type_id: t.tipoId,
          third_party_id_num: t.idNum,
          third_party_address: t.direccion ?? '',
          third_party_phone: t.telefono ?? '',
          third_party_email: t.email ?? '',
        }
      : {}),
  };
}
