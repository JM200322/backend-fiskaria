/**
 * Tipos del contrato de la Imprenta Digital. Los nombres de campo replican LITERALMENTE
 * el API (incluidos typos como `ammount`, `adress`, `weigth`). No "corregir".
 * Ver: SDD modulos/10-imprenta-digital/api-imprenta.md.
 */

/** Línea de factura (`bill_items`). */
export interface ImprentaBillItem {
  type: 'item' | 'boleto';
  description_elm_fac: string;
  code_elm_fac: string;
  num_elm_fac: number;
  cost_unit_elm_fac: number;
  cost_total_elm_fac: number;
  tax_elm_fac: string; // "G" | "E"
  tax_percentage: string; // "16%"
}

/** Payload de `POST /api/generateBill`. */
export interface ImprentaFacturaPayload {
  type: 'FACTURA' | 'FACTURA_TERCEROS';
  client_full_name: string;
  doc_num: string;
  client_type_id: string;
  client_id_num: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  emition_date: string; // DD-MM-YYYY
  emition_hour: string; // HH:MM:SS
  payment_method: string;
  currency: string; // "VES"
  notify_client: string; // "1" | "0"
  subtotal: number;
  total_w_taxes: number;
  total_tax: number;
  igtf: number;
  tasa_bcv: number;
  bill_items: ImprentaBillItem[];
  // Solo en FACTURA_TERCEROS (RN-126):
  third_party_full_name?: string;
  third_party_type_id?: string;
  third_party_id_num?: string;
  third_party_address?: string;
  third_party_phone?: string;
  third_party_email?: string;
}

/** Datos del comprador comunes a factura/NC/ND. */
interface ImprentaClienteCampos {
  client_full_name: string;
  client_type_id: string;
  client_id_num: string;
  client_address: string;
  client_phone: string;
  client_email: string;
}

/** Línea de nota de crédito (`credit_note_elem`). */
export interface ImprentaCreditNoteItem {
  type: 'item';
  description_elm_credit_note: string;
  code_elm_credit_note: string;
  num_elm_credit_note: number;
  cost_unit_elm_credit_note: number;
  cost_total_elm_credit_note: number;
  tax_elm_credit_note: string;
  digital_credit_note_tax_percentage: string;
}

/** Línea de nota de débito (`debit_note_elem`). */
export interface ImprentaDebitNoteItem {
  type: 'item';
  description_elm_debit_note: string;
  code_elm_debit_note: string;
  num_elm_debit_note: number;
  cost_unit_elm_debit_note: number;
  cost_total_elm_debit_note: number;
  tax_elm_debit_note: string;
  digital_debit_note_tax_percentage: string;
}

/** Campos comunes de NC/ND (totales, factura afectada, etc.). */
interface ImprentaNotaBase extends ImprentaClienteCampos {
  doc_num: string;
  emition_date: string;
  emition_hour: string;
  reason_to: string;
  doc_num_fac: string; // doc_num de la factura afectada (o "")
  affected_control_num: string; // número de control de la factura afectada (o "")
  payment_method: string;
  subtotal: number;
  total_w_taxes: number;
  total_tax: number;
  igtf: number;
  tasa_bcv: number;
}

export interface ImprentaNotaCreditoPayload extends ImprentaNotaBase {
  type: 'NOTA_CREDITO';
  credit_note_elem: ImprentaCreditNoteItem[];
}

export interface ImprentaNotaDebitoPayload extends ImprentaNotaBase {
  type: 'NOTA_DEBITO' | 'NOTA_DEBITO_TERCEROS';
  debit_note_elem: ImprentaDebitNoteItem[];
}

/** Datos del agente de retención / beneficiario (comunes a IVA/ISLR). */
interface ImprentaRetencionPartes {
  beneficiary_doc_type: string;
  beneficiary_doc_id: string;
  beneficiary_name: string;
  beneficiary_adress: string; // sic (una "d")
  beneficiary_email: string;
  retention_agent_doc_type: string;
  retention_agent_doc_id: string;
  retention_agent_name: string;
  retention_agent_adress: string; // sic
  retention_agent_email: string;
}

/** Payload de `POST /generateVoucherIVA`. Montos con doble "m" (sic). */
export interface ImprentaRetencionIvaPayload extends ImprentaRetencionPartes {
  doc_num: string;
  billing_period_year: string;
  billing_period_month: string;
  total_ammount: number;
  no_tax_credit_ammount: number;
  withholding_base: number;
  total_tax: number;
  detanied_total: number; // sic: la API usa "detanied" (typo) SOLO en este campo top-level
  emition_date: string;
  emition_hour: string;
  iva_voucher_elements: {
    fac_date: string;
    fac_control_num: string;
    fac_document_num: string;
    credit_note_num: string;
    debit_note_num: string;
    emended_fac_document_num: string;
    doc_total_ammount: number;
    no_tax_credit_ammount: number;
    withholding_base: number;
    tax_percentage: string;
    tax_iva: number;
    detained_tax_iva: number;
  }[];
}

/** Payload de `POST /generateVoucherIslr`. */
export interface ImprentaRetencionIslrPayload extends ImprentaRetencionPartes {
  doc_num: string;
  emition_date: string;
  emition_hour: string;
  billing_period_year: string;
  billing_period_month: string;
  withholding_base: number;
  amount_withheld: number;
  amount_subtracting: number;
  islr_voucher_elements: {
    fac_date: string;
    fac_control_num: string;
    fac_document_num: string;
    retention_code: string;
    payment_concept: string;
    fac_total_ammount: number;
    retention_ammount: number; // sic: doble "m" (typo del API en este ítem)
    subtracting_amount: number;
    portion_percentage: string;
  }[];
}

/** Payload de `POST /generateShippingOrder` (guía de despacho). `adress`/`weigth` sic. */
export interface ImprentaGuiaPayload {
  type: 'GUIA_DESPACHO';
  doc_num: string;
  client_full_name: string;
  client_type_id: string;
  client_id_num: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  driver_full_name: string;
  driver_type_id: string;
  driver_id_num: string;
  car_plate: string;
  car_make: string;
  car_model: string;
  car_color: string;
  buy_order: string;
  reason_to: string;
  adress_from: string;
  adress_to: string;
  total_weigth: string; // peso total del despacho (sic: "weigth"). Requerido por la API.
  emition_date: string;
  emition_hour: string;
  subtotal: number;
  total_w_taxes: number;
  total_tax: number;
  igtf: number;
  tasa_bcv: number;
  shipping_order_elem: {
    description_elm_shipping_order: string;
    code_elm_shipping_order: string;
    num_elm_shipping_order: number;
    cost_unit_elm_shipping_order: number;
    cost_total_elm_shipping_order: number;
    weigth_elm_shipping_orders: string;
    tax_elm_shipping_order: string;
    tax_percentage_shipping_order: string;
  }[];
}

/**
 * Respuesta normalizada del adaptador. Formato real de la imprenta (validado contra el
 * sandbox): { success, message, data: { control_num, id, verification_hash, public_url,
 * verification_url, ... } }. La imprenta ASIGNA el número de control (RN-007).
 */
export interface ImprentaRespuesta {
  numeroControl: string; // = data.control_num
  estatus: string;
  idRemoto?: string; // = data.id
  hashVerificacion?: string; // = data.verification_hash
  urlPublica?: string; // = data.public_url (PDF en el visor)
  urlVerificacion?: string; // = data.verification_url (QR)
}

export class ImprentaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImprentaError';
  }
}
