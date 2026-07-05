import { Injectable, NotFoundException } from '@nestjs/common';
import { EstatusDocumento, TipoDocumento, TipoRetencion } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/** Alícuotas estándar del Libro (16 general, 8 reducida, 31 adicional). */
const ALICUOTAS = ['16', '8', '31'] as const;

interface DesgloseFila {
  alicuota: string;
  base: string;
  iva: string;
}

@Injectable()
export class LibrosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Libro de Ventas del período (formato SENIAT): documentos emitidos con número de control,
   * en orden cronológico, con desglose por alícuota y resumen final. RN-011/012.
   */
  async libroVentas(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);
    const encabezado = await this.encabezado(contribuyenteId, 'Libro de Ventas', year, month);

    const docs = await this.prisma.documentoFiscal.findMany({
      where: {
        contribuyenteId,
        estatus: EstatusDocumento.ENVIADO,
        fecha: { gte: desde, lt: hasta },
        tipo: { in: [TipoDocumento.FACTURA, TipoDocumento.NOTA_DEBITO, TipoDocumento.NOTA_CREDITO] },
      },
      include: {
        cliente: { select: { rif: true, nombre: true } },
        documentoOrigen: { select: { docNum: true } },
      },
      orderBy: [{ fecha: 'asc' }, { docNum: 'asc' }],
    });

    const resumen = this.nuevoResumen();
    let exentasTotal = new Decimal(0);
    let montoTotalGeneral = new Decimal(0);

    const filas = docs.map((d, i) => {
      const esNc = d.tipo === TipoDocumento.NOTA_CREDITO;
      const signo = esNc ? -1 : 1;
      const desglose = (d.desgloseIva as unknown as DesgloseFila[]) ?? [];

      const porAlicuota = this.bucketsPorAlicuota(desglose, signo, resumen);
      const exenta = this.montoExento(desglose).times(signo);
      exentasTotal = exentasTotal.plus(exenta);
      const montoTotal = new Decimal(d.totalWTaxes).times(signo);
      montoTotalGeneral = montoTotalGeneral.plus(montoTotal);
      const baseImponible = Object.values(porAlicuota)
        .reduce((acc, b) => acc.plus(b.base), new Decimal(0))
        .plus(exenta);
      const totalIva = Object.values(porAlicuota).reduce((acc, b) => acc.plus(b.iva), new Decimal(0));

      return {
        nroOperacion: i + 1,
        fecha: d.fecha,
        rifComprador: d.cliente.rif,
        nombreComprador: d.cliente.nombre,
        numeroFactura: d.tipo === TipoDocumento.FACTURA ? d.docNum : '',
        numeroControl: d.numeroControl,
        numeroNota: d.tipo !== TipoDocumento.FACTURA ? d.docNum : '',
        tipoTransaccion: d.tipo === TipoDocumento.FACTURA ? '01-Reg' : '02-Aju',
        facturaAfectada: d.documentoOrigen?.docNum ?? '',
        montoTotal: montoTotal.toFixed(2),
        exentas: exenta.toFixed(2),
        exportaciones: '0.00', // no se manejan exportaciones (fuera de alcance)
        baseImponible: baseImponible.toFixed(2),
        totalIva: totalIva.toFixed(2),
        porAlicuota,
      };
    });

    // Retención de IVA que nos practicaron los clientes (aparece en el resumen de ventas).
    const retIva = await this.prisma.retencionRecibida.aggregate({
      where: { contribuyenteId, tipo: TipoRetencion.IVA, fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
    });

    return {
      encabezado,
      filas,
      resumen: {
        exentas: exentasTotal.toFixed(2),
        exportaciones: '0.00',
        porAlicuota: this.formatearResumen(resumen),
        baseImponibleTotal: resumen.baseTotal.toFixed(2),
        debitoFiscal: resumen.ivaTotal.toFixed(2),
        retencionIvaRecibida: new Decimal(retIva._sum.monto ?? 0).toFixed(2),
        montoTotal: montoTotalGeneral.toFixed(2),
      },
    };
  }

  /**
   * Libro de Compras del período (formato SENIAT): compras con IVA crédito, desglose por
   * alícuota, columnas de retención IVA y resumen por categoría.
   */
  async libroCompras(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);
    const encabezado = await this.encabezado(contribuyenteId, 'Libro de Compras', year, month);

    const compras = await this.prisma.compra.findMany({
      where: { contribuyenteId, fecha: { gte: desde, lt: hasta } },
      include: {
        proveedor: { select: { rif: true, nombre: true } },
        retenciones: {
          where: { tipo: TipoRetencion.IVA },
          select: { docNum: true, montoRetenido: true, fecha: true },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    const resumen = this.nuevoResumen();
    let exentasTotal = new Decimal(0);
    let ivaRetenidoTotal = new Decimal(0);

    const filas = compras.map((c, i) => {
      const base = new Decimal(c.base);
      const iva = new Decimal(c.ivaCredito);
      // La alícuota se infiere de la relación IVA/base (16, 8, 31) o exenta si IVA = 0.
      const alic = base.gt(0) ? String(Math.round(iva.dividedBy(base).times(100).toNumber())) : '0';
      const porAlicuota = this.nuevoPorAlicuota();
      if (alic === '0' || iva.isZero()) {
        exentasTotal = exentasTotal.plus(base);
      } else if (ALICUOTAS.includes(alic as (typeof ALICUOTAS)[number])) {
        porAlicuota[alic] = { base: base.toFixed(2), iva: iva.toFixed(2) };
        resumen.porAlicuota[alic].base = resumen.porAlicuota[alic].base.plus(base);
        resumen.porAlicuota[alic].iva = resumen.porAlicuota[alic].iva.plus(iva);
        resumen.baseTotal = resumen.baseTotal.plus(base);
        resumen.ivaTotal = resumen.ivaTotal.plus(iva);
      }
      const ret = c.retenciones[0];
      if (ret) ivaRetenidoTotal = ivaRetenidoTotal.plus(ret.montoRetenido);

      return {
        nroOperacion: i + 1,
        fecha: c.fecha,
        rifProveedor: c.proveedor.rif,
        nombreProveedor: c.proveedor.nombre,
        numeroFactura: c.numeroFactura,
        numeroControl: c.numeroControl ?? '',
        numeroNota: '', // no se registran NC/ND de compra por ahora
        facturaAfectada: '',
        numeroPlanillaImportacion: '',
        numeroExpedienteImportacion: '',
        tipoTransaccion: '01-Reg',
        totalCompras: c.total.toString(),
        exentas: alic === '0' ? base.toFixed(2) : '0.00',
        baseImponible: base.toFixed(2),
        totalIva: iva.toFixed(2),
        porAlicuota,
        retencionIva: ret
          ? { monto: ret.montoRetenido.toString(), comprobante: ret.docNum, fecha: ret.fecha }
          : null,
      };
    });

    return {
      encabezado,
      filas,
      resumen: {
        exentas: exentasTotal.toFixed(2),
        porAlicuota: this.formatearResumen(resumen),
        baseImponibleTotal: resumen.baseTotal.toFixed(2),
        creditoFiscal: resumen.ivaTotal.toFixed(2),
        ivaRetenido: ivaRetenidoTotal.toFixed(2),
      },
    };
  }

  /** Resumen de declaración de IVA: débito − crédito − retenciones (CT6/RN-011). */
  async resumenIva(actor: AuthenticatedUser, year: number, month: number) {
    const ventas = await this.libroVentas(actor, year, month);
    const compras = await this.libroCompras(actor, year, month);

    const debito = new Decimal(ventas.resumen.debitoFiscal);
    const credito = new Decimal(compras.resumen.creditoFiscal);
    const retIva = new Decimal(ventas.resumen.retencionIvaRecibida);
    const montoADeclarar = debito.minus(credito).minus(retIva);

    return {
      periodo: { year, month },
      debitoFiscal: debito.toFixed(2),
      creditoFiscal: credito.toFixed(2),
      retencionesIva: retIva.toFixed(2),
      montoADeclarar: montoADeclarar.toFixed(2),
    };
  }

  /** Resumen de IGTF del período (RN-010): 3% ya calculado y persistido por documento. */
  async resumenIgtf(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const docs = await this.prisma.documentoFiscal.findMany({
      where: {
        contribuyenteId,
        estatus: EstatusDocumento.ENVIADO,
        fecha: { gte: desde, lt: hasta },
        igtf: { gt: 0 },
      },
      select: { igtf: true },
    });

    const total = docs.reduce((acc, d) => acc.plus(d.igtf), new Decimal(0));
    return {
      periodo: `${year}-${String(month).padStart(2, '0')}`,
      totalIgtf: total.toFixed(2),
      operaciones: docs.length,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private nuevoPorAlicuota(): Record<string, { base: string; iva: string }> {
    return {
      '16': { base: '0.00', iva: '0.00' },
      '8': { base: '0.00', iva: '0.00' },
      '31': { base: '0.00', iva: '0.00' },
    };
  }

  private nuevoResumen() {
    return {
      porAlicuota: {
        '16': { base: new Decimal(0), iva: new Decimal(0) },
        '8': { base: new Decimal(0), iva: new Decimal(0) },
        '31': { base: new Decimal(0), iva: new Decimal(0) },
      } as Record<string, { base: Decimal; iva: Decimal }>,
      baseTotal: new Decimal(0),
      ivaTotal: new Decimal(0),
    };
  }

  /** Reparte el desglose de un documento en columnas por alícuota y acumula el resumen. */
  private bucketsPorAlicuota(
    desglose: DesgloseFila[],
    signo: number,
    resumen: ReturnType<LibrosService['nuevoResumen']>,
  ) {
    const porAlicuota = this.nuevoPorAlicuota();
    for (const d of desglose) {
      if (!ALICUOTAS.includes(d.alicuota as (typeof ALICUOTAS)[number])) continue;
      const base = new Decimal(d.base).times(signo);
      const iva = new Decimal(d.iva).times(signo);
      porAlicuota[d.alicuota] = { base: base.toFixed(2), iva: iva.toFixed(2) };
      resumen.porAlicuota[d.alicuota].base = resumen.porAlicuota[d.alicuota].base.plus(base);
      resumen.porAlicuota[d.alicuota].iva = resumen.porAlicuota[d.alicuota].iva.plus(iva);
      resumen.baseTotal = resumen.baseTotal.plus(base);
      resumen.ivaTotal = resumen.ivaTotal.plus(iva);
    }
    return porAlicuota;
  }

  private montoExento(desglose: DesgloseFila[]): Decimal {
    return desglose
      .filter((d) => d.alicuota === '0')
      .reduce((acc, d) => acc.plus(d.base), new Decimal(0));
  }

  private formatearResumen(resumen: ReturnType<LibrosService['nuevoResumen']>) {
    const out: Record<string, { base: string; iva: string }> = {};
    for (const a of ALICUOTAS) {
      out[a] = {
        base: resumen.porAlicuota[a].base.toFixed(2),
        iva: resumen.porAlicuota[a].iva.toFixed(2),
      };
    }
    return out;
  }

  private async encabezado(contribuyenteId: string, nombre: string, year: number, month: number) {
    const c = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { rif: true, razonSocial: true },
    });
    const { desde, hasta } = this.rango(year, month);
    const finMes = new Date(hasta.getTime() - 86_400_000);
    return {
      libro: nombre,
      razonSocial: c?.razonSocial ?? '',
      rif: c?.rif ?? '',
      periodoDesde: desde.toISOString().slice(0, 10),
      periodoHasta: finMes.toISOString().slice(0, 10),
    };
  }

  private rango(year: number, month: number) {
    return {
      desde: new Date(Date.UTC(year, month - 1, 1)),
      hasta: new Date(Date.UTC(year, month, 1)),
    };
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new NotFoundException('Operación de contabilidad requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
