import { ImprentaRetencionIvaPayload, ImprentaRetencionIslrPayload } from '../imprenta.types';
import { formatearFechaImprenta } from './factura.mapper';

interface Parte {
  docType: string;
  docId: string;
  nombre: string;
  direccion?: string | null;
  email?: string | null;
}

export interface DatosRetencionImprenta {
  docNum: string;
  periodoYear: string;
  periodoMonth: string;
  fecha: Date;
  hora: string;
  beneficiario: Parte; // proveedor retenido
  agente: Parte; // el contribuyente
  facDate: Date;
  facDocumentNum: string;
  facControlNum: string;
}

function partes(b: Parte, a: Parte) {
  return {
    beneficiary_doc_type: b.docType,
    beneficiary_doc_id: b.docId,
    beneficiary_name: b.nombre,
    beneficiary_adress: b.direccion ?? '',
    beneficiary_email: b.email ?? '',
    retention_agent_doc_type: a.docType,
    retention_agent_doc_id: a.docId,
    retention_agent_name: a.nombre,
    retention_agent_adress: a.direccion ?? '',
    retention_agent_email: a.email ?? '',
  };
}

/** Retención de IVA. `base` = IVA de la compra; `montoRetenido` = base × %. */
export function construirPayloadRetencionIva(
  d: DatosRetencionImprenta & { totalFactura: number; base: number; porcentaje: number; montoRetenido: number },
): ImprentaRetencionIvaPayload {
  return {
    doc_num: d.docNum,
    billing_period_year: d.periodoYear,
    billing_period_month: d.periodoMonth,
    ...partes(d.beneficiario, d.agente),
    total_ammount: d.totalFactura,
    no_tax_credit_ammount: 0,
    withholding_base: d.base,
    total_tax: d.base,
    detanied_total: d.montoRetenido,
    emition_date: formatearFechaImprenta(d.fecha),
    emition_hour: d.hora,
    iva_voucher_elements: [
      {
        fac_date: formatearFechaImprenta(d.facDate),
        fac_control_num: d.facControlNum,
        fac_document_num: d.facDocumentNum,
        credit_note_num: '',
        debit_note_num: '',
        emended_fac_document_num: '',
        doc_total_ammount: d.totalFactura,
        no_tax_credit_ammount: 0,
        withholding_base: d.base,
        tax_percentage: `${d.porcentaje}%`,
        tax_iva: d.base,
        detained_tax_iva: d.montoRetenido,
      },
    ],
  };
}

/** Retención de ISLR. `montoRetenido` = base × % − sustraendo (decreto 1.808). */
export function construirPayloadRetencionIslr(
  d: DatosRetencionImprenta & {
    totalFactura: number;
    base: number;
    porcentaje: number;
    montoRetenido: number;
    sustraendo: number;
    concepto: string;
    retentionCode: string;
  },
): ImprentaRetencionIslrPayload {
  return {
    doc_num: d.docNum,
    emition_date: formatearFechaImprenta(d.fecha),
    emition_hour: d.hora,
    billing_period_year: d.periodoYear,
    billing_period_month: d.periodoMonth,
    ...partes(d.beneficiario, d.agente),
    withholding_base: d.base,
    amount_withheld: d.montoRetenido,
    amount_subtracting: d.sustraendo,
    islr_voucher_elements: [
      {
        fac_date: formatearFechaImprenta(d.facDate),
        fac_control_num: d.facControlNum,
        fac_document_num: d.facDocumentNum,
        retention_code: d.retentionCode,
        payment_concept: d.concepto,
        fac_total_ammount: d.totalFactura,
        retention_ammount: d.montoRetenido,
        subtracting_amount: d.sustraendo,
        portion_percentage: `${d.porcentaje}%`,
      },
    ],
  };
}
