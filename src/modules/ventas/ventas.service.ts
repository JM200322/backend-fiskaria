import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoVenta, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { calcularBaseLinea, calcularDocumento, redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EmitirFacturaDto } from '../facturador/dto/emitir-factura.dto';
import { FacturadorService } from '../facturador/facturador.service';
import { ConvertirVentaDto } from './dto/convertir-venta.dto';
import { CrearVentaDto } from './dto/crear-venta.dto';

const incluir = {
  tercero: { select: { rif: true, nombre: true } },
  items: { include: { producto: { select: { codigo: true, nombre: true } } } },
};

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facturador: FacturadorService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Cliente válido del contribuyente (compartido por crear/actualizar). */
  private async resolverCliente(clienteId: string, contribuyenteId: string) {
    const cliente = await this.prisma.tercero.findFirst({
      where: { id: clienteId, contribuyenteId, esCliente: true, deletedAt: null },
    });
    if (!cliente) throw new BadRequestException('Cliente inválido');
    return cliente;
  }

  /** Resuelve productos + cálculo fiscal estimado (compartido por crear/actualizar). */
  private async resolverItems(items: { productoId: string; cantidad: number }[], contribuyenteId: string) {
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: items.map((i) => i.productoId) }, contribuyenteId, deletedAt: null },
      include: { categoriaFiscal: true },
    });
    const mapa = new Map(productos.map((p) => [p.id, p]));

    const resueltos = items.map((it) => {
      const prod = mapa.get(it.productoId);
      if (!prod) throw new BadRequestException(`Producto inválido: ${it.productoId}`);
      return {
        producto: prod,
        cantidad: it.cantidad,
        alicuota: new Decimal(prod.ivaOverride ?? prod.categoriaFiscal.alicuotaIva),
      };
    });

    const calc = calcularDocumento(
      resueltos.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.producto.precio, alicuota: i.alicuota })),
    );
    return { items: resueltos, calc };
  }

  /** CU-1: crea una cotización (no es documento fiscal — RN-103). */
  async crear(dto: CrearVentaDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const cliente = await this.resolverCliente(dto.clienteId, contribuyenteId);
    const { items, calc } = await this.resolverItems(dto.items, contribuyenteId);

    const venta = await this.prisma.venta.create({
      data: {
        contribuyenteId,
        terceroId: cliente.id,
        estado: EstadoVenta.COTIZACION,
        totalEstimado: calc.total,
        items: {
          create: items.map((i) => ({
            productoId: i.producto.id,
            descripcion: i.producto.nombre,
            cantidad: i.cantidad,
            precio: redondear(i.producto.precio).toFixed(2),
          })),
        },
      },
      include: incluir,
    });
    await this.audit(actor, ip, 'crear_cotizacion', venta.id);
    return venta;
  }

  /** Edita cliente/ítems de una cotización — solo mientras siga en COTIZACION (RN-103). */
  async actualizar(id: string, dto: CrearVentaDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const venta = await this.obtener(id, actor);
    if (venta.estado !== EstadoVenta.COTIZACION) {
      throw new BadRequestException('Solo una cotización sin confirmar puede editarse');
    }
    const cliente = await this.resolverCliente(dto.clienteId, contribuyenteId);
    const { items, calc } = await this.resolverItems(dto.items, contribuyenteId);

    const actualizada = await this.prisma.$transaction(async (tx) => {
      await tx.ventaItem.deleteMany({ where: { ventaId: id } });
      return tx.venta.update({
        where: { id },
        data: {
          terceroId: cliente.id,
          totalEstimado: calc.total,
          items: {
            create: items.map((i) => ({
              productoId: i.producto.id,
              descripcion: i.producto.nombre,
              cantidad: i.cantidad,
              precio: redondear(i.producto.precio).toFixed(2),
            })),
          },
        },
        include: incluir,
      });
    });
    await this.audit(actor, ip, 'editar_cotizacion', id);
    return actualizada;
  }

  /** CU-2: confirma una cotización. */
  async confirmar(id: string, actor: AuthenticatedUser, ip?: string) {
    const venta = await this.obtener(id, actor);
    if (venta.estado !== EstadoVenta.COTIZACION) {
      throw new BadRequestException('Solo una cotización puede confirmarse');
    }
    const actualizada = await this.prisma.venta.update({
      where: { id },
      data: { estado: EstadoVenta.CONFIRMADA },
      include: incluir,
    });
    await this.audit(actor, ip, 'confirmar_venta', id);
    return actualizada;
  }

  /** Anula una venta que no haya sido facturada. */
  async anular(id: string, actor: AuthenticatedUser, ip?: string) {
    const venta = await this.obtener(id, actor);
    if (venta.estado === EstadoVenta.FACTURADA) {
      throw new BadRequestException('No se puede anular una venta ya facturada');
    }
    const actualizada = await this.prisma.venta.update({
      where: { id },
      data: { estado: EstadoVenta.ANULADA },
      include: incluir,
    });
    await this.audit(actor, ip, 'anular_venta', id);
    return actualizada;
  }

  /** CU-3: convierte una venta confirmada en factura (deriva al Facturador — V2/RN-008/009). */
  async convertirEnFactura(id: string, dto: ConvertirVentaDto, actor: AuthenticatedUser, ip?: string) {
    const venta = await this.obtener(id, actor);
    if (venta.estado !== EstadoVenta.CONFIRMADA) {
      throw new BadRequestException('Solo una venta confirmada puede facturarse');
    }

    const facturaDto: EmitirFacturaDto = {
      puntoEmisionId: dto.puntoEmisionId,
      clienteId: venta.terceroId,
      tasaBcv: dto.tasaBcv,
      pagos: dto.pagos,
      items: venta.items.map((i) => ({ productoId: i.productoId, cantidad: Number(i.cantidad) })),
    };

    // Aplica todas las reglas del Facturador (RIF validado, alícuotas, numeración, imprenta…).
    const factura = await this.facturador.emitirFactura(facturaDto, actor, ip);

    const actualizada = await this.prisma.venta.update({
      where: { id },
      data: { estado: EstadoVenta.FACTURADA, documentoFiscalId: factura.id },
      include: incluir,
    });
    await this.audit(actor, ip, 'facturar_venta', id, { facturaId: factura.id });
    return { venta: actualizada, factura };
  }

  async listar(actor: AuthenticatedUser, estado?: EstadoVenta) {
    const ventas = await this.prisma.venta.findMany({
      where: { contribuyenteId: this.tenantId(actor), estado },
      include: incluir,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.conPaymentMethod(ventas);
  }

  /** Adjunta el método de pago real (columna "Forma de pago") desde el DocumentoFiscal ya emitido. */
  private async conPaymentMethod<T extends { documentoFiscalId: string | null }>(
    ventas: T[],
  ): Promise<(T & { paymentMethod: string | null })[]> {
    const ids = [...new Set(ventas.map((v) => v.documentoFiscalId).filter((id): id is string => !!id))];
    if (ids.length === 0) return ventas.map((v) => ({ ...v, paymentMethod: null }));
    const docs = await this.prisma.documentoFiscal.findMany({
      where: { id: { in: ids } },
      select: { id: true, paymentMethod: true },
    });
    const mapa = new Map(docs.map((d) => [d.id, d.paymentMethod]));
    return ventas.map((v) => ({
      ...v,
      paymentMethod: v.documentoFiscalId ? (mapa.get(v.documentoFiscalId) ?? null) : null,
    }));
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const venta = await this.prisma.venta.findFirst({
      where: { id, contribuyenteId: this.tenantId(actor) },
      include: incluir,
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return venta;
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de ventas requiere contexto de comercio');
    }
    return actor.contribuyenteId;
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
      entidad: 'venta',
      entidadId,
      detalle,
    });
  }
}
