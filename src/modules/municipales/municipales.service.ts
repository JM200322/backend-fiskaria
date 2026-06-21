import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoImpuesto } from '@prisma/client';
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
