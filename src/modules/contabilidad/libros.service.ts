import { Injectable, NotFoundException } from '@nestjs/common';
import { EstatusDocumento, TipoDocumento, TipoRetencion } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Injectable()
export class LibrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Libro de Ventas del período (RN-011/012): documentos emitidos con número de control. */
  async libroVentas(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const docs = await this.prisma.documentoFiscal.findMany({
      where: {
        contribuyenteId,
        estatus: EstatusDocumento.ENVIADO, // solo con número de control (RN-011)
        fecha: { gte: desde, lt: hasta },
        tipo: { in: [TipoDocumento.FACTURA, TipoDocumento.NOTA_DEBITO, TipoDocumento.NOTA_CREDITO] },
      },
      include: { cliente: { select: { rif: true, nombre: true } } },
      orderBy: [{ fecha: 'asc' }, { docNum: 'asc' }],
    });

    let baseImponible = new Decimal(0);
    let debitoFiscal = new Decimal(0);
    const filas = docs.map((d) => {
      // Las NC restan; facturas y ND suman.
      const signo = d.tipo === TipoDocumento.NOTA_CREDITO ? -1 : 1;
      baseImponible = baseImponible.plus(new Decimal(d.subtotal).times(signo));
      debitoFiscal = debitoFiscal.plus(new Decimal(d.totalTax).times(signo));
      return {
        fecha: d.fecha,
        tipo: d.tipo,
        docNum: d.docNum,
        numeroControl: d.numeroControl,
        clienteRif: d.cliente.rif,
        clienteNombre: d.cliente.nombre,
        base: d.subtotal,
        iva: d.totalTax,
        total: d.totalWTaxes,
        igtf: d.igtf,
      };
    });

    return {
      periodo: { year, month },
      filas,
      totales: {
        baseImponible: baseImponible.toFixed(2),
        debitoFiscal: debitoFiscal.toFixed(2),
      },
    };
  }

  /** Libro de Compras del período: compras (IVA crédito) + retenciones IVA practicadas. */
  async libroCompras(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const compras = await this.prisma.compra.findMany({
      where: { contribuyenteId, fecha: { gte: desde, lt: hasta } },
      include: { proveedor: { select: { rif: true, nombre: true } } },
      orderBy: { fecha: 'asc' },
    });

    let baseImponible = new Decimal(0);
    let creditoFiscal = new Decimal(0);
    const filas = compras.map((c) => {
      baseImponible = baseImponible.plus(c.base);
      creditoFiscal = creditoFiscal.plus(c.ivaCredito);
      return {
        fecha: c.fecha,
        numeroFactura: c.numeroFactura,
        numeroControl: c.numeroControl,
        proveedorRif: c.proveedor.rif,
        proveedorNombre: c.proveedor.nombre,
        base: c.base,
        ivaCredito: c.ivaCredito,
        total: c.total,
      };
    });

    return {
      periodo: { year, month },
      filas,
      totales: {
        baseImponible: baseImponible.toFixed(2),
        creditoFiscal: creditoFiscal.toFixed(2),
      },
    };
  }

  /** Resumen de declaración de IVA: débito − crédito − retenciones (CT6/RN-011). */
  async resumenIva(actor: AuthenticatedUser, year: number, month: number) {
    const ventas = await this.libroVentas(actor, year, month);
    const compras = await this.libroCompras(actor, year, month);
    const { desde, hasta } = this.rango(year, month);

    const retenciones = await this.prisma.comprobanteRetencion.aggregate({
      where: {
        contribuyenteId: this.tenantId(actor),
        tipo: TipoRetencion.IVA,
        estatus: EstatusDocumento.ENVIADO,
        fecha: { gte: desde, lt: hasta },
      },
      _sum: { montoRetenido: true },
    });
    const retIva = new Decimal(retenciones._sum.montoRetenido ?? 0);

    const debito = new Decimal(ventas.totales.debitoFiscal);
    const credito = new Decimal(compras.totales.creditoFiscal);
    const montoADeclarar = debito.minus(credito).minus(retIva);

    return {
      periodo: { year, month },
      debitoFiscal: debito.toFixed(2),
      creditoFiscal: credito.toFixed(2),
      retencionesIva: retIva.toFixed(2),
      montoADeclarar: montoADeclarar.toFixed(2),
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
