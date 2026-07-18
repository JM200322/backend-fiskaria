import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstatusCompra, Prisma, TipoProducto } from '@prisma/client';
import Decimal from 'decimal.js';
import { paginacion, rangoFecha } from 'src/common/date-range.util';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { CompraItemDto, RegistrarCompraDto, RegistrarPagoProveedorDto } from './dto/registrar-compra.dto';

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly contabilidad: ContabilidadService,
  ) {}

  async registrar(dto: RegistrarCompraDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const proveedor = await this.prisma.tercero.findFirst({
      where: { id: dto.proveedorId, contribuyenteId, esProveedor: true, deletedAt: null },
    });
    if (!proveedor) throw new BadRequestException('Proveedor inválido');
    if (dto.items?.length) await this.assertItemsAlmacenables(dto.items, contribuyenteId);

    const total = redondear(new Decimal(dto.base).plus(dto.ivaCredito)).toFixed(2);
    const compra = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.compra.create({
        data: {
          contribuyenteId,
          proveedorTerceroId: proveedor.id,
          numeroFactura: dto.numeroFactura,
          numeroControl: dto.numeroControl,
          fecha: new Date(dto.fecha),
          base: dto.base,
          ivaCredito: dto.ivaCredito,
          total,
        },
      });
      if (dto.items?.length) {
        await tx.compraItem.createMany({
          data: dto.items.map((item) => ({
            compraId: creada.id,
            productoId: item.productoId,
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
          })),
        });
      }
      return creada;
    });
    // Libro Diario (RN-107): la compra se registra a crédito (CxP); el pago se
    // liquida aparte vía agregarPago (no genera un segundo asiento — ponytail:
    // agregar el asiento de pago cuando el flujo de tesorería lo requiera).
    await this.contabilidad.registrarAutomatico({
      contribuyenteId,
      fecha: new Date(dto.fecha),
      glosa: `Compra ${dto.numeroFactura} — ${proveedor.nombre}`,
      documentoRef: compra.id,
      lineas: [
        { evento: 'compras_gasto', debe: dto.base },
        { evento: 'iva_credito', debe: dto.ivaCredito },
        { evento: 'cuentas_por_pagar', haber: total },
      ],
    });

    await this.audit(actor, ip, 'registrar_compra', compra.id, { numeroFactura: dto.numeroFactura });
    return compra;
  }

  listar(
    actor: AuthenticatedUser,
    opts: { desde?: string; hasta?: string; limit?: number; offset?: number } = {},
  ) {
    const contribuyenteId = this.tenantId(actor);
    const { take, skip } = paginacion(opts.limit, opts.offset);
    return this.prisma.compra.findMany({
      where: { contribuyenteId, fecha: rangoFecha(opts.desde, opts.hasta) },
      include: {
        proveedor: { select: { rif: true, nombre: true } },
        // Solo tipo+monto: la fila de la lista solo necesita el resumen, no el
        // detalle completo del comprobante (eso lo trae obtener() aparte).
        retenciones: { select: { tipo: true, montoRetenido: true } },
      },
      // Desempate por `id` para paginación estable (mismo patrón que Facturador).
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take,
      skip,
    });
  }

  /**
   * KPIs de la página de Compras: SUM/COUNT/GROUP BY sobre todo el dataset del
   * tenant (no sobre la página cargada por `listar()`) — a diferencia de la
   * lista, que sí está acotada por `paginacion()`, estos totales no pueden
   * perder facturas viejas una vez el tenant supera el cap de 100/200.
   */
  async kpis(actor: AuthenticatedUser, opts: { topLimit?: number } = {}) {
    const contribuyenteId = this.tenantId(actor);
    const now = new Date();
    const desdeMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const hastaMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const topLimit = opts.topLimit ?? 4;

    const [totalCompras, mes, porPagar, porProveedor] = await Promise.all([
      this.prisma.compra.count({ where: { contribuyenteId } }),
      this.prisma.compra.aggregate({
        where: { contribuyenteId, fecha: { gte: desdeMes, lt: hastaMes } },
        _sum: { total: true, ivaCredito: true },
        _count: true,
      }),
      this.prisma.compra.aggregate({
        where: {
          contribuyenteId,
          estado: { in: [EstatusCompra.REGISTRADA, EstatusCompra.PAGADA_PARCIAL] },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.compra.groupBy({
        by: ['proveedorTerceroId'],
        where: { contribuyenteId },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: topLimit,
      }),
    ]);

    const proveedores = await this.prisma.tercero.findMany({
      where: { id: { in: porProveedor.map((p) => p.proveedorTerceroId) } },
      select: { id: true, rif: true, nombre: true },
    });
    const porId = new Map(proveedores.map((p) => [p.id, p]));

    return {
      totalCompras,
      mes: {
        total: (mes._sum.total ?? new Decimal(0)).toFixed(2),
        ivaCredito: (mes._sum.ivaCredito ?? new Decimal(0)).toFixed(2),
        cantidad: mes._count,
      },
      porPagar: {
        total: (porPagar._sum.total ?? new Decimal(0)).toFixed(2),
        cantidad: porPagar._count,
      },
      topProveedores: porProveedor.map((p) => ({
        rif: porId.get(p.proveedorTerceroId)?.rif ?? '',
        nombre: porId.get(p.proveedorTerceroId)?.nombre ?? '',
        total: (p._sum.total ?? new Decimal(0)).toFixed(2),
      })),
    };
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const compra = await this.prisma.compra.findFirst({
      where: { id, contribuyenteId },
      include: {
        proveedor: true,
        pagos: true,
        retenciones: true,
        items: { include: { producto: { select: { id: true, codigo: true, nombre: true } } } },
      },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  async agregarPago(compraId: string, dto: RegistrarPagoProveedorDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    // SELECT ... FOR UPDATE serializa pagos concurrentes sobre la misma compra:
    // sin esto, dos pagos simultáneos podrían leer el mismo saldo pendiente y
    // sobrepasar el total de la factura (TOCTOU).
    const estado = await this.prisma.$transaction(async (tx) => {
      const bloqueada = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM compras WHERE id = ${compraId} AND contribuyente_id = ${contribuyenteId} FOR UPDATE
      `;
      if (bloqueada.length === 0) throw new NotFoundException('Compra no encontrada');

      const compra = await tx.compra.findFirstOrThrow({
        where: { id: compraId },
        include: { pagos: true },
      });

      const pagado = compra.pagos.reduce((acc, p) => acc.plus(p.monto), new Decimal(0)).plus(dto.monto);
      if (pagado.gt(new Decimal(compra.total))) {
        throw new BadRequestException('El pago excede el saldo de la compra');
      }
      const nuevoEstado = pagado.gte(new Decimal(compra.total))
        ? EstatusCompra.PAGADA_TOTAL
        : EstatusCompra.PAGADA_PARCIAL;

      await tx.pagoProveedor.create({
        data: {
          compraId,
          monto: dto.monto,
          referencia: dto.referencia,
          fecha: new Date(dto.fecha),
        },
      });
      await tx.compra.update({ where: { id: compraId }, data: { estado: nuevoEstado } });
      return nuevoEstado;
    });

    await this.audit(actor, ip, 'pago_proveedor', compraId, { monto: dto.monto, estado });
    return this.obtener(compraId, actor);
  }

  /**
   * Busca la línea de factura de un producto por N° de factura (RN-134) —
   * usada por Reponer Stock para mostrar el proveedor y topar la cantidad
   * repuesta contra lo que la factura indica para ESE producto puntual.
   * Si la factura trae varios productos, cada uno tiene su propia línea
   * (mismo compraId, distinto productoId), así que el match es siempre
   * inequívoco sin importar cuántos ítems tenga la factura.
   *
   * numeroFactura es el documento del PROVEEDOR, no un identificador único
   * del sistema — dos proveedores distintos podrían coincidir en el mismo
   * número para el mismo producto. Si eso pasa, se reporta ambiguo en vez
   * de elegir uno arbitrariamente (antes se tomaba el más reciente).
   */
  async buscarLineaFactura(productoId: string, numeroFactura: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const items = await this.prisma.compraItem.findMany({
      where: { productoId, compra: { contribuyenteId, numeroFactura } },
      include: { compra: { include: { proveedor: { select: { nombre: true } } } }, movimientos: true },
      orderBy: { createdAt: 'desc' },
    });
    if (items.length === 0) return { encontrado: false as const, ambiguo: false as const };
    if (items.length > 1) return { encontrado: false as const, ambiguo: true as const };

    const item = items[0];
    const repuesta = item.movimientos.reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
    const restante = new Decimal(item.cantidad).minus(repuesta);
    return {
      encontrado: true as const,
      compraItemId: item.id,
      numeroFactura: item.compra.numeroFactura,
      proveedorNombre: item.compra.proveedor.nombre,
      cantidadFactura: item.cantidad.toFixed(3),
      cantidadRepuesta: repuesta.toFixed(3),
      cantidadRestante: restante.toFixed(3),
      costoUnitario: item.costoUnitario.toFixed(2),
    };
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de compras requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }

  /** Cada línea debe apuntar a un producto Almacenable del propio comercio (RN-121). */
  private async assertItemsAlmacenables(items: CompraItemDto[], contribuyenteId: string) {
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: items.map((i) => i.productoId) }, contribuyenteId, deletedAt: null },
      select: { id: true, tipo: true, nombre: true },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    const vistos = new Set<string>();
    for (const item of items) {
      const producto = porId.get(item.productoId);
      if (!producto) throw new BadRequestException(`Producto ${item.productoId} inválido`);
      if (producto.tipo !== TipoProducto.ALMACENABLE) {
        throw new BadRequestException('Solo los productos almacenables pueden ser línea de una compra');
      }
      // A lo sumo una línea por producto (constraint única en BD) — se valida
      // aquí también para dar un mensaje claro en vez del error crudo de Postgres.
      if (vistos.has(item.productoId)) {
        throw new BadRequestException(`"${producto.nombre}" está repetido — cada producto va en una sola línea`);
      }
      vistos.add(item.productoId);
    }
  }

  private audit(
    actor: AuthenticatedUser,
    ip: string | undefined,
    accion: string,
    entidadId: string,
    detalle?: Prisma.InputJsonValue,
  ) {
    return this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      ip,
      accion,
      entidad: 'compra',
      entidadId,
      detalle,
    });
  }
}
