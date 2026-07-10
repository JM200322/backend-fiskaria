import { ImprentaGuiaPayload } from '../imprenta.types';
import { formatearFechaImprenta } from './factura.mapper';

export interface DatosGuiaImprenta {
  docNum: string;
  cliente: {
    nombre: string;
    tipoId: string;
    idNum: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
  };
  conductor: { nombre: string; tipoId: string; idNum: string };
  vehiculo: { placa: string; marca?: string; modelo?: string; color?: string };
  ordenCompra?: string;
  motivo: string;
  direccionOrigen: string;
  direccionDestino: string;
  fecha: Date;
  hora: string;
  subtotal: number;
  totalTax: number;
  totalWTaxes: number;
  tasaBcv: number;
  items: {
    descripcion: string;
    codigo: string;
    cantidad: number;
    costoUnit: number;
    costoTotal: number;
    pesoKg: number;
    taxElm: string;
    taxPercentage: string;
  }[];
}

/** Construye el payload de `POST /generateShippingOrder` con los nombres exactos del API. */
export function construirPayloadGuia(d: DatosGuiaImprenta): ImprentaGuiaPayload {
  return {
    type: 'GUIA_DESPACHO',
    doc_num: d.docNum,
    client_full_name: d.cliente.nombre,
    client_type_id: d.cliente.tipoId,
    client_id_num: d.cliente.idNum,
    client_address: d.cliente.direccion ?? '',
    client_phone: d.cliente.telefono ?? '',
    client_email: d.cliente.email ?? '',
    driver_full_name: d.conductor.nombre,
    driver_type_id: d.conductor.tipoId,
    driver_id_num: d.conductor.idNum,
    car_plate: d.vehiculo.placa,
    car_make: d.vehiculo.marca ?? '',
    car_model: d.vehiculo.modelo ?? '',
    car_color: d.vehiculo.color ?? '',
    buy_order: d.ordenCompra ?? '',
    reason_to: d.motivo,
    adress_from: d.direccionOrigen,
    adress_to: d.direccionDestino,
    total_weigth: String(d.items.reduce((s, it) => s + (it.pesoKg ?? 0), 0)),
    emition_date: formatearFechaImprenta(d.fecha),
    emition_hour: d.hora,
    subtotal: d.subtotal,
    total_w_taxes: d.totalWTaxes,
    total_tax: d.totalTax,
    igtf: 0,
    tasa_bcv: d.tasaBcv,
    shipping_order_elem: d.items.map((it) => ({
      description_elm_shipping_order: it.descripcion,
      code_elm_shipping_order: it.codigo,
      num_elm_shipping_order: it.cantidad,
      cost_unit_elm_shipping_order: it.costoUnit,
      cost_total_elm_shipping_order: it.costoTotal,
      weigth_elm_shipping_orders: String(it.pesoKg ?? 0),
      tax_elm_shipping_order: it.taxElm,
      tax_percentage_shipping_order: it.taxPercentage,
    })),
  };
}
