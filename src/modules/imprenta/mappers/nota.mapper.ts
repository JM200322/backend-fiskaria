import {
  ImprentaNotaCreditoPayload,
  ImprentaNotaDebitoPayload,
} from '../imprenta.types';
import { formatearFechaImprenta, mapearPaymentMethodImprenta } from './factura.mapper';

/** Datos de nota (crédito o débito) en términos del dominio. */
export interface DatosNotaImprenta {
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
  hora: string;
  motivo: string;
  facturaDocNum: string; // doc_num de la factura afectada
  facturaNumeroControl: string | null; // número de control de la factura afectada
  paymentMethod: string;
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
    taxElm: string;
    taxPercentage: string;
  }[];
}

function clienteYBase(d: DatosNotaImprenta) {
  return {
    client_full_name: d.cliente.nombre,
    doc_num: d.docNum,
    client_type_id: d.cliente.tipoId,
    client_id_num: d.cliente.idNum,
    client_address: d.cliente.direccion ?? '',
    client_phone: d.cliente.telefono ?? '',
    client_email: d.cliente.email ?? '',
    emition_date: formatearFechaImprenta(d.fecha),
    emition_hour: d.hora,
    reason_to: d.motivo,
    doc_num_fac: d.facturaDocNum,
    affected_control_num: d.facturaNumeroControl ?? '',
    payment_method: mapearPaymentMethodImprenta(d.paymentMethod),
    subtotal: d.subtotal,
    total_w_taxes: d.totalWTaxes,
    total_tax: d.totalTax,
    igtf: d.igtf,
    tasa_bcv: d.tasaBcv,
  };
}

export function construirPayloadNotaCredito(d: DatosNotaImprenta): ImprentaNotaCreditoPayload {
  return {
    type: 'NOTA_CREDITO',
    ...clienteYBase(d),
    credit_note_elem: d.items.map((it) => ({
      type: 'item',
      description_elm_credit_note: it.descripcion,
      code_elm_credit_note: it.codigo,
      num_elm_credit_note: it.cantidad,
      cost_unit_elm_credit_note: it.costoUnit,
      cost_total_elm_credit_note: it.costoTotal,
      tax_elm_credit_note: it.taxElm,
      digital_credit_note_tax_percentage: it.taxPercentage,
    })),
  };
}

export function construirPayloadNotaDebito(d: DatosNotaImprenta): ImprentaNotaDebitoPayload {
  return {
    type: 'NOTA_DEBITO',
    ...clienteYBase(d),
    debit_note_elem: d.items.map((it) => ({
      type: 'item',
      description_elm_debit_note: it.descripcion,
      code_elm_debit_note: it.codigo,
      num_elm_debit_note: it.cantidad,
      cost_unit_elm_debit_note: it.costoUnit,
      cost_total_elm_debit_note: it.costoTotal,
      tax_elm_debit_note: it.taxElm,
      digital_debit_note_tax_percentage: it.taxPercentage,
    })),
  };
}
