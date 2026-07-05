import { Injectable, NotFoundException } from '@nestjs/common';
import { EstatusDocumento, TipoDocumento } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LibrosService } from '../contabilidad/libros.service';

export type RangoVentas = '7d' | '30d' | 'anio';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly libros: LibrosService,
  ) {}

  /** Resumen del período actual: ventas, situación fiscal, alertas. */
  async resumen(actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 1));
    const mesAnteriorDesde = new Date(Date.UTC(year, month - 2, 1));

    // Ventas del mes (facturas emitidas) y del mes anterior (para el delta).
    const [ventas, ventasMesAnterior] = await Promise.all([
      this.prisma.documentoFiscal.aggregate({
        where: {
          contribuyenteId,
          tipo: TipoDocumento.FACTURA,
          estatus: EstatusDocumento.ENVIADO,
          fecha: { gte: desde, lt: hasta },
        },
        _count: true,
        _sum: { totalWTaxes: true },
      }),
      this.prisma.documentoFiscal.count({
        where: {
          contribuyenteId,
          tipo: TipoDocumento.FACTURA,
          estatus: EstatusDocumento.ENVIADO,
          fecha: { gte: mesAnteriorDesde, lt: desde },
        },
      }),
    ]);

    // Ventas de hoy vs. ayer (para el hero).
    const hoyInicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const hoyFin = new Date(hoyInicio.getTime() + 86_400_000);
    const ayerInicio = new Date(hoyInicio.getTime() - 86_400_000);
    const [ventasHoy, ventasAyer] = await Promise.all([
      this.prisma.documentoFiscal.aggregate({
        where: {
          contribuyenteId,
          tipo: TipoDocumento.FACTURA,
          estatus: EstatusDocumento.ENVIADO,
          fecha: { gte: hoyInicio, lt: hoyFin },
        },
        _sum: { totalWTaxes: true },
      }),
      this.prisma.documentoFiscal.aggregate({
        where: {
          contribuyenteId,
          tipo: TipoDocumento.FACTURA,
          estatus: EstatusDocumento.ENVIADO,
          fecha: { gte: ayerInicio, lt: hoyInicio },
        },
        _sum: { totalWTaxes: true },
      }),
    ]);
    const totalHoy = new Decimal(ventasHoy._sum.totalWTaxes ?? 0);
    const totalAyer = new Decimal(ventasAyer._sum.totalWTaxes ?? 0);
    const deltaHoyPct = totalAyer.gt(0)
      ? totalHoy.minus(totalAyer).dividedBy(totalAyer).times(100).toDecimalPlaces(1).toNumber()
      : null;

    // Situación fiscal (débito − crédito − retenciones).
    const fiscal = await this.libros.resumenIva(actor, year, month);

    // Alertas: stock crítico y documentos sin transmitir.
    const almacenables = await this.prisma.producto.findMany({
      where: { contribuyenteId, tipo: 'ALMACENABLE', deletedAt: null },
      select: { stock: true, stockMinimo: true },
    });
    const stockCritico = almacenables.filter(
      (p) => Number(p.stockMinimo) > 0 && Number(p.stock) <= Number(p.stockMinimo),
    ).length;

    const documentosNoEnviados = await this.prisma.documentoFiscal.count({
      where: { contribuyenteId, estatus: EstatusDocumento.NO_ENVIADO },
    });

    return {
      periodo: { year, month },
      hoy: { totalBs: totalHoy.toFixed(2), deltaPct: deltaHoyPct },
      ventasMes: {
        cantidad: ventas._count,
        cantidadMesAnterior: ventasMesAnterior,
        total: (ventas._sum.totalWTaxes ?? new Decimal(0)).toFixed(2),
      },
      fiscal,
      alertas: { stockCritico, documentosNoEnviados },
    };
  }

  /** Serie de ventas para el gráfico, según el rango (RN-109: montos en Bs). */
  async ventas(actor: AuthenticatedUser, rango: RangoVentas) {
    const contribuyenteId = this.tenantId(actor);
    const now = new Date();

    let desde: Date;
    if (rango === '7d') desde = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    else if (rango === '30d') desde = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    else desde = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const facturas = await this.prisma.documentoFiscal.findMany({
      where: {
        contribuyenteId,
        tipo: TipoDocumento.FACTURA,
        estatus: EstatusDocumento.ENVIADO,
        fecha: { gte: desde },
      },
      select: { fecha: true, totalWTaxes: true },
    });

    const buckets = this.crearBuckets(rango, now);
    for (const f of facturas) {
      const idx = this.indiceBucket(rango, f.fecha, now);
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx].total = new Decimal(buckets[idx].total).plus(f.totalWTaxes).toFixed(2);
      }
    }
    return { rango, series: buckets };
  }

  private crearBuckets(rango: RangoVentas, now: Date) {
    if (rango === '7d') {
      const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + i));
        return { etiqueta: dias[d.getUTCDay()], total: '0.00' };
      });
    }
    if (rango === '30d') {
      return Array.from({ length: 5 }, (_, i) => ({ etiqueta: `Sem ${i + 1}`, total: '0.00' }));
    }
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses.map((m) => ({ etiqueta: m, total: '0.00' }));
  }

  private indiceBucket(rango: RangoVentas, fecha: Date, now: Date): number {
    if (rango === '7d') {
      const inicio = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6);
      const dia = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
      return Math.floor((dia - inicio) / 86_400_000);
    }
    if (rango === '30d') {
      return Math.min(4, Math.floor((fecha.getUTCDate() - 1) / 7)); // semana del mes (0-4)
    }
    return fecha.getUTCMonth(); // 0-11
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new NotFoundException('El dashboard requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
