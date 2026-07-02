import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstatusCompra, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { RegistrarCompraDto, RegistrarPagoProveedorDto } from './dto/registrar-compra.dto';

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

    const total = redondear(new Decimal(dto.base).plus(dto.ivaCredito)).toFixed(2);
    const compra = await this.prisma.compra.create({
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

  listar(actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    return this.prisma.compra.findMany({
      where: { contribuyenteId },
      include: { proveedor: { select: { rif: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const compra = await this.prisma.compra.findFirst({
      where: { id, contribuyenteId },
      include: { proveedor: true, pagos: true, retenciones: true },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  async agregarPago(compraId: string, dto: RegistrarPagoProveedorDto, actor: AuthenticatedUser, ip?: string) {
    const compra = await this.obtener(compraId, actor);

    const pagado = compra.pagos.reduce((acc, p) => acc.plus(p.monto), new Decimal(0)).plus(dto.monto);
    if (pagado.gt(new Decimal(compra.total))) {
      throw new BadRequestException('El pago excede el saldo de la compra');
    }
    const estado = pagado.gte(new Decimal(compra.total))
      ? EstatusCompra.PAGADA_TOTAL
      : EstatusCompra.PAGADA_PARCIAL;

    await this.prisma.$transaction([
      this.prisma.pagoProveedor.create({
        data: {
          compraId,
          monto: dto.monto,
          referencia: dto.referencia,
          fecha: new Date(dto.fecha),
        },
      }),
      this.prisma.compra.update({ where: { id: compraId }, data: { estado } }),
    ]);

    await this.audit(actor, ip, 'pago_proveedor', compraId, { monto: dto.monto, estado });
    return this.obtener(compraId, actor);
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de compras requiere contexto de comercio');
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
      entidad: 'compra',
      entidadId,
      detalle,
    });
  }
}
