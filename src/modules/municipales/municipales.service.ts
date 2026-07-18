import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoImpuesto, EstatusDocumento, TipoDocumento } from '@prisma/client';
import Decimal from 'decimal.js';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  CalcularImpuestoDto,
  CrearActividadDto,
  RegistrarPagoMunicipalDto,
} from './dto/municipales.dto';

@Injectable()
export class MunicipalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Actividades económicas ──────────────────────────────────────────────
  async crearActividad(dto: CrearActividadDto, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const dup = await this.prisma.actividadEconomica.findUnique({
      where: { contribuyenteId_codigo: { contribuyenteId, codigo: dto.codigo } },
    });
    if (dup) throw new BadRequestException(`Ya existe la actividad ${dto.codigo}`);
    return this.prisma.actividadEconomica.create({
      data: { contribuyenteId, codigo: dto.codigo, descripcion: dto.descripcion, alicuota: dto.alicuota },
    });
  }

  listarActividades(actor: AuthenticatedUser) {
    return this.prisma.actividadEconomica.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      orderBy: { codigo: 'asc' },
    });
  }

  // ── Impuestos ───────────────────────────────────────────────────────────
  /** Calcula y registra el impuesto del período: monto = base × alícuota de la actividad. */
  async calcular(dto: CalcularImpuestoDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const actividad = await this.prisma.actividadEconomica.findFirst({
      where: { id: dto.actividadId, contribuyenteId },
    });
    if (!actividad) throw new BadRequestException('Actividad económica inválida');

    const monto = redondear(new Decimal(dto.base).times(actividad.alicuota).dividedBy(100));
    const impuesto = await this.prisma.impuestoMunicipal.create({
      data: {
        contribuyenteId,
        actividadId: actividad.id,
        periodo: dto.periodo,
        base: dto.base,
        monto: monto.toFixed(2),
      },
      include: { actividad: { select: { codigo: true, descripcion: true, alicuota: true } } },
    });
    await this.audit(actor, ip, 'calcular_impuesto_municipal', impuesto.id, { periodo: dto.periodo });
    return impuesto;
  }

  /**
   * Base imponible sugerida del IAE: ingresos brutos reales del período tomados
   * de las facturas emitidas (subtotal neto de IVA/IGTF), Facturas + Notas de
   * Débito menos Notas de Crédito. Es una sugerencia editable, no autoritativa.
   */
  async baseSugerida(actor: AuthenticatedUser, periodo: string) {
    const contribuyenteId = this.tenantId(actor);
    const m = /^(\d{4})-(\d{2})$/.exec(periodo);
    if (!m) throw new BadRequestException('periodo debe ser YYYY-MM');
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) throw new BadRequestException('periodo inválido');

    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 1));

    // Solo ENVIADO: hoy es el único estatus con número de control y valor fiscal.
    // Revisar al implementar reverso (ANULADO_POR_REVERSO) o CONTINGENCIA, que aún
    // no se asignan en el backend. GUIA_DESPACHO y retenciones quedan fuera a propósito.
    const sumar = (tipos: TipoDocumento[]) =>
      this.prisma.documentoFiscal.aggregate({
        where: {
          contribuyenteId,
          estatus: EstatusDocumento.ENVIADO,
          tipo: { in: tipos },
          fecha: { gte: desde, lt: hasta },
        },
        _sum: { subtotal: true },
        _count: true,
      });

    const [positivos, notasCredito] = await Promise.all([
      sumar([TipoDocumento.FACTURA, TipoDocumento.NOTA_DEBITO]),
      sumar([TipoDocumento.NOTA_CREDITO]),
    ]);

    const ingresos = new Decimal(positivos._sum.subtotal ?? 0).minus(
      notasCredito._sum.subtotal ?? 0,
    );

    return {
      periodo,
      ingresosBrutos: Decimal.max(ingresos, 0).toFixed(2),
      documentos: positivos._count + notasCredito._count,
    };
  }

  listarImpuestos(actor: AuthenticatedUser, estado?: EstadoImpuesto) {
    return this.prisma.impuestoMunicipal.findMany({
      where: { contribuyenteId: this.tenantId(actor), estado },
      include: { actividad: { select: { codigo: true, descripcion: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Registra el comprobante de pago (hecho en banco/portal) y marca PAGADO. */
  async registrarPago(id: string, dto: RegistrarPagoMunicipalDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const impuesto = await this.prisma.impuestoMunicipal.findFirst({ where: { id, contribuyenteId } });
    if (!impuesto) throw new NotFoundException('Impuesto no encontrado');
    if (impuesto.estado === EstadoImpuesto.PAGADO) {
      throw new BadRequestException('El impuesto ya está pagado');
    }
    const actualizado = await this.prisma.impuestoMunicipal.update({
      where: { id },
      data: {
        estado: EstadoImpuesto.PAGADO,
        referenciaPago: dto.referencia,
        fechaPago: new Date(dto.fecha),
      },
    });
    await this.audit(actor, ip, 'pagar_impuesto_municipal', id, { referencia: dto.referencia });
    return actualizado;
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación municipal requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }

  private audit(
    actor: AuthenticatedUser,
    ip: string | undefined,
    accion: string,
    entidadId: string,
    detalle?: Record<string, unknown>,
  ) {
    return this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      ip,
      accion,
      entidad: 'impuesto_municipal',
      entidadId,
      detalle: detalle as never,
    });
  }
}
