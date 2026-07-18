import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Producto, TipoProducto } from '@prisma/client';
import Decimal from 'decimal.js';
import { paginacion } from 'src/common/date-range.util';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ComprasService } from '../compras/compras.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ReponerStockDto } from './dto/reponer-stock.dto';
import { OpenFoodFactsService } from './open-food-facts.service';

const incluirRelaciones = {
  categoriaFiscal: true,
  categoriaComercial: true,
  proveedores: { include: { tercero: { select: { id: true, rif: true, nombre: true } } } },
};

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly contabilidad: ContabilidadService,
    private readonly openFoodFacts: OpenFoodFactsService,
    private readonly compras: ComprasService,
  ) {}

  /** Ver ComprasService.buscarLineaFactura — expuesto aquí porque quien llama es Reponer Stock. */
  async buscarLineaFactura(id: string, numeroFactura: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return this.compras.buscarLineaFactura(id, numeroFactura, actor);
  }

  /**
   * Busca primero en el catálogo del propio contribuyente (código de barras real
   * de un producto físico); si no existe ahí, consulta Open Food Facts para
   * sugerir datos con los que precargar "Nuevo producto" (RN: el backend nunca
   * crea el producto solo; el alta la confirma el usuario).
   */
  async buscarPorCodigoBarras(codigoBarras: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { contribuyenteId, codigoBarras, deletedAt: null },
      include: incluirRelaciones,
    });
    if (producto) {
      return { encontradoEn: 'catalogo' as const, producto: this.conIva(producto) };
    }

    const sugerencia = await this.openFoodFacts.buscarPorCodigoBarras(codigoBarras);
    if (sugerencia) {
      return { encontradoEn: 'openfoodfacts' as const, sugerencia };
    }
    return { encontradoEn: 'ninguno' as const };
  }

  async crear(dto: CrearProductoDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    await this.assertCategoriaFiscal(dto.categoriaFiscalId);
    await this.assertCategoriaComercial(dto.categoriaComercialId, contribuyenteId);
    await this.assertProveedores(dto.proveedorIds, contribuyenteId);

    const duplicado = await this.prisma.producto.findUnique({
      where: { contribuyenteId_codigo: { contribuyenteId, codigo: dto.codigo } },
    });
    if (duplicado) {
      throw new BadRequestException(`Ya existe un producto con el código ${dto.codigo}`);
    }
    await this.assertCodigoBarrasDisponible(dto.codigoBarras, contribuyenteId);

    // Solo los almacenables manejan stock (RN-121, I6).
    const esAlmacenable = dto.tipo === TipoProducto.ALMACENABLE;

    const producto = await this.prisma.producto.create({
      data: {
        contribuyenteId,
        codigo: dto.codigo,
        nombre: dto.nombre,
        tipo: dto.tipo,
        categoriaFiscalId: dto.categoriaFiscalId,
        categoriaComercialId: dto.categoriaComercialId,
        ivaOverride: dto.ivaOverride ?? null,
        precio: dto.precio,
        stock: esAlmacenable ? (dto.stock ?? 0) : 0,
        stockMinimo: esAlmacenable ? (dto.stockMinimo ?? 0) : 0,
        codigoBarras: dto.codigoBarras,
        lote: dto.lote,
        unidadMedida: dto.unidadMedida,
        proveedores: dto.proveedorIds?.length
          ? { create: dto.proveedorIds.map((terceroId) => ({ terceroId })) }
          : undefined,
      },
      include: incluirRelaciones,
    });

    await this.audit(actor, ip, 'crear_producto', producto.id, { codigo: dto.codigo });
    return this.conIva(producto);
  }

  async listar(
    actor: AuthenticatedUser,
    opts: {
      q?: string;
      tipo?: TipoProducto;
      bajoStock?: boolean;
      categoriaComercialId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const contribuyenteId = this.tenantId(actor);
    const where: Prisma.ProductoWhereInput = { contribuyenteId, deletedAt: null };
    if (opts.tipo) where.tipo = opts.tipo;
    if (opts.categoriaComercialId) where.categoriaComercialId = opts.categoriaComercialId;
    if (opts.q) {
      where.OR = [
        { nombre: { contains: opts.q, mode: 'insensitive' } },
        { codigo: { contains: opts.q, mode: 'insensitive' } },
        { codigoBarras: { contains: opts.q, mode: 'insensitive' } },
      ];
    }
    const { take, skip } = paginacion(opts.limit, opts.offset);
    const productos = await this.prisma.producto.findMany({
      where,
      include: incluirRelaciones,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }], // desempate estable para paginar por skip/take
      take,
      skip,
    });
    const conIva = productos.map((p) => this.conIva(p));
    return opts.bajoStock ? conIva.filter((p) => p.bajoStock) : conIva;
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
      include: incluirRelaciones,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return this.conIva(producto);
  }

  async actualizar(id: string, dto: ActualizarProductoDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const actual = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
    });
    if (!actual) throw new NotFoundException('Producto no encontrado');

    if (dto.categoriaFiscalId) await this.assertCategoriaFiscal(dto.categoriaFiscalId);
    if (dto.categoriaComercialId)
      await this.assertCategoriaComercial(dto.categoriaComercialId, contribuyenteId);
    if (dto.proveedorIds) await this.assertProveedores(dto.proveedorIds, contribuyenteId);
    if (dto.codigoBarras !== undefined) {
      await this.assertCodigoBarrasDisponible(dto.codigoBarras, contribuyenteId, id);
    }

    const data: Prisma.ProductoUpdateInput = {
      nombre: dto.nombre,
      tipo: dto.tipo,
      ivaOverride: dto.ivaOverride,
      precio: dto.precio,
      stockMinimo: dto.stockMinimo,
      codigoBarras: dto.codigoBarras,
      lote: dto.lote,
      unidadMedida: dto.unidadMedida,
    };
    if (dto.categoriaFiscalId)
      data.categoriaFiscal = { connect: { id: dto.categoriaFiscalId } };
    if (dto.categoriaComercialId)
      data.categoriaComercial = { connect: { id: dto.categoriaComercialId } };

    // Reemplazo de proveedores si se envían.
    if (dto.proveedorIds) {
      await this.prisma.productoProveedor.deleteMany({ where: { productoId: id } });
      data.proveedores = { create: dto.proveedorIds.map((terceroId) => ({ terceroId })) };
    }

    const producto = await this.prisma.producto.update({
      where: { id },
      data,
      include: incluirRelaciones,
    });
    await this.audit(actor, ip, 'actualizar_producto', id);
    return this.conIva(producto);
  }

  /**
   * Reposición de stock (entrada de inventario). Solo ALMACENABLE (RN-121):
   * incrementa stock, fija costoUltimo (base "última compra", no PEPS/promedio),
   * y registra el asiento con los MISMOS eventos que Compras (compras_gasto/
   * iva_credito/cuentas_por_pagar) — una reposición ES una compra de inventario,
   * solo que capturada desde Inventario en vez del flujo de Compras.
   */
  async reponerStock(id: string, dto: ReponerStockDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.tipo !== TipoProducto.ALMACENABLE) {
      throw new BadRequestException('Solo los productos almacenables controlan stock (RN-121)');
    }

    const costoTotal = redondear(new Decimal(dto.cantidad).times(dto.costoUnitario));
    const ivaCredito = redondear(dto.ivaCredito ?? 0);
    const fecha = new Date();

    const { productoActualizado, movimiento } = await this.prisma.$transaction(async (tx) => {
      if (dto.compraItemId) {
        // SELECT ... FOR UPDATE serializa reposiciones concurrentes contra la
        // MISMA línea de factura — sin esto, dos reposiciones simultáneas
        // podrían leer el mismo "restante" antes de que la otra confirme y
        // sobregirar la factura (mismo TOCTOU que agregarPago ya resuelve).
        const bloqueada = await tx.$queryRaw<{ id: string }[]>`
          SELECT ci.id FROM compra_items ci
          JOIN compras c ON c.id = ci.compra_id
          WHERE ci.id = ${dto.compraItemId} AND ci.producto_id = ${id} AND c.contribuyente_id = ${contribuyenteId}
          FOR UPDATE
        `;
        if (bloqueada.length === 0) {
          throw new BadRequestException('La línea de factura indicada no es válida para este producto');
        }
        await this.assertCantidadDentroDeFactura(tx, dto.compraItemId, dto.cantidad);
      }

      const productoActualizado = await tx.producto.update({
        where: { id },
        data: {
          stock: { increment: dto.cantidad },
          costoUltimo: dto.costoUnitario,
        },
        include: incluirRelaciones,
      });
      const movimiento = await tx.movimientoInventario.create({
        data: {
          contribuyenteId,
          productoId: id,
          cantidad: dto.cantidad,
          costoUnitario: dto.costoUnitario,
          costoTotal: costoTotal.toFixed(2),
          ivaCredito: ivaCredito.toFixed(2),
          referencia: dto.referencia,
          compraItemId: dto.compraItemId,
          fecha,
        },
      });
      return { productoActualizado, movimiento };
    });

    // Libro Diario (RN-107): best-effort, no bloquea la reposición si falta config.
    await this.contabilidad.registrarAutomatico({
      contribuyenteId,
      fecha,
      glosa: `Reposición de stock — ${producto.nombre}`,
      documentoRef: movimiento.id,
      lineas: [
        { evento: 'compras_gasto', debe: costoTotal },
        { evento: 'iva_credito', debe: ivaCredito },
        { evento: 'cuentas_por_pagar', haber: costoTotal.plus(ivaCredito) },
      ],
    });

    await this.audit(actor, ip, 'reponer_stock', id, {
      cantidad: dto.cantidad,
      costoUnitario: dto.costoUnitario,
    });
    return { producto: this.conIva(productoActualizado), movimiento };
  }

  /** Guarda la ruta pública del archivo ya escrito a disco por Multer (ver controller). */
  async guardarImagen(id: string, rutaPublica: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const actualizado = await this.prisma.producto.update({
      where: { id },
      data: { imagenUrl: rutaPublica },
      include: incluirRelaciones,
    });
    return this.conIva(actualizado);
  }

  async historialMovimientos(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const producto = await this.prisma.producto.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return this.prisma.movimientoInventario.findMany({
      where: { productoId: id, contribuyenteId },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
  }

  /** Alícuota de IVA efectiva: override del producto, o la de su categoría fiscal (RN-102). */
  private conIva(producto: Producto & { categoriaFiscal: { alicuotaIva: Prisma.Decimal } }) {
    const iva = producto.ivaOverride ?? producto.categoriaFiscal.alicuotaIva;
    // Stock en negativo es "bajo stock" siempre, incluso sin stock mínimo
    // configurado (stockMinimo=0) — de lo contrario un producto sobrevendido
    // desaparece por completo del radar de "Bajo stock".
    const bajoStock =
      producto.tipo === TipoProducto.ALMACENABLE &&
      (Number(producto.stock) < 0 ||
        (Number(producto.stockMinimo) > 0 && Number(producto.stock) <= Number(producto.stockMinimo)));
    return { ...producto, ivaAplicable: iva, bajoStock };
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de productos requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }

  private async assertCategoriaFiscal(id: string) {
    const cf = await this.prisma.categoriaFiscal.findUnique({ where: { id } });
    if (!cf) throw new BadRequestException('Categoría fiscal inválida');
  }

  private async assertCategoriaComercial(id: string | undefined, contribuyenteId: string) {
    if (!id) return;
    const cc = await this.prisma.categoriaComercial.findFirst({ where: { id, contribuyenteId } });
    if (!cc) throw new BadRequestException('Categoría comercial inválida');
  }

  /**
   * Dos productos del mismo comercio no pueden compartir código de barras —
   * rompería el "escanea y encuéntralo" (buscarPorCodigoBarras siempre
   * traería el primero que matchee). `excluirProductoId` permite que un
   * producto conserve su propio código al editarse.
   */
  private async assertCodigoBarrasDisponible(
    codigoBarras: string | undefined,
    contribuyenteId: string,
    excluirProductoId?: string,
  ) {
    if (!codigoBarras) return;
    const conflicto = await this.prisma.producto.findFirst({
      where: {
        contribuyenteId,
        codigoBarras,
        deletedAt: null,
        id: excluirProductoId ? { not: excluirProductoId } : undefined,
      },
      select: { nombre: true },
    });
    if (conflicto) {
      throw new BadRequestException(
        `Este código de barras ya está asignado a "${conflicto.nombre}". Si es el correcto para este producto, genera uno nuevo para "${conflicto.nombre}" — así cada producto conserva un código único.`,
      );
    }
  }

  /**
   * RN-134: la cantidad repuesta contra una línea de factura no puede superar
   * lo facturado. Recibe `tx` (el cliente de la transacción que YA tomó el
   * lock FOR UPDATE sobre la línea, ver reponerStock) para que esta lectura
   * quede serializada respecto a otra reposición concurrente — leer fuera de
   * esa transacción permitiría a dos reposiciones ver el mismo "restante"
   * antes de que la otra confirme.
   */
  private async assertCantidadDentroDeFactura(
    tx: Prisma.TransactionClient,
    compraItemId: string,
    cantidad: number,
  ) {
    const item = await tx.compraItem.findFirst({
      where: { id: compraItemId },
      include: { compra: { include: { proveedor: { select: { nombre: true } } } }, movimientos: true },
    });
    if (!item) {
      throw new BadRequestException('La línea de factura indicada no es válida para este producto');
    }
    const repuesta = item.movimientos.reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
    const restante = new Decimal(item.cantidad).minus(repuesta);
    if (new Decimal(cantidad).gt(restante)) {
      throw new BadRequestException(
        `La factura ${item.compra.numeroFactura} de ${item.compra.proveedor.nombre} indica ` +
          `${item.cantidad} unidades de este producto y ya se repusieron ${repuesta.toFixed(3)} — ` +
          `quedan ${restante.toFixed(3)} por reponer.`,
      );
    }
  }

  private async assertProveedores(ids: string[] | undefined, contribuyenteId: string) {
    if (!ids?.length) return;
    const encontrados = await this.prisma.tercero.findMany({
      where: { id: { in: ids }, contribuyenteId, esProveedor: true, deletedAt: null },
      select: { id: true },
    });
    if (encontrados.length !== ids.length) {
      throw new BadRequestException('Uno o más proveedores no existen o no son proveedores');
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
      entidad: 'producto',
      entidadId,
      detalle,
    });
  }
}
