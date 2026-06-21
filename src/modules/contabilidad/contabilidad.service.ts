import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigenAsiento, Prisma, TipoCuenta } from '@prisma/client';
import Decimal from 'decimal.js';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ConfigCuentaDto, CrearAsientoDto, CrearCuentaDto } from './dto/contabilidad.dto';

@Injectable()
export class ContabilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Plan de cuentas (RN-135: sin precarga) ──────────────────────────────
  async crearCuenta(dto: CrearCuentaDto, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const dup = await this.prisma.planCuenta.findUnique({
      where: { contribuyenteId_codigo: { contribuyenteId, codigo: dto.codigo } },
    });
    if (dup) throw new BadRequestException(`Ya existe la cuenta ${dto.codigo}`);
    return this.prisma.planCuenta.create({
      data: { contribuyenteId, codigo: dto.codigo, nombre: dto.nombre, tipo: dto.tipo as TipoCuenta },
    });
  }

  listarCuentas(actor: AuthenticatedUser) {
    return this.prisma.planCuenta.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      orderBy: { codigo: 'asc' },
    });
  }

  // ── Mapeo evento → cuenta (RN-135/107) ──────────────────────────────────
  async setConfig(dto: ConfigCuentaDto, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const cuenta = await this.prisma.planCuenta.findFirst({
      where: { id: dto.cuentaId, contribuyenteId },
    });
    if (!cuenta) throw new BadRequestException('Cuenta inválida');
    return this.prisma.configCuentaContable.upsert({
      where: { contribuyenteId_evento: { contribuyenteId, evento: dto.evento } },
      update: { cuentaId: dto.cuentaId },
      create: { contribuyenteId, evento: dto.evento, cuentaId: dto.cuentaId },
    });
  }

  listarConfig(actor: AuthenticatedUser) {
    return this.prisma.configCuentaContable.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      include: { cuenta: { select: { codigo: true, nombre: true } } },
    });
  }

  // ── Asientos ────────────────────────────────────────────────────────────
  async registrarManual(dto: CrearAsientoDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    // Validación de partida doble: Σ debe = Σ haber, > 0, cada línea con un solo lado.
    let debe = new Decimal(0);
    let haber = new Decimal(0);
    for (const l of dto.lineas) {
      if (l.debe > 0 && l.haber > 0) {
        throw new BadRequestException('Cada línea debe tener debe O haber, no ambos');
      }
      debe = debe.plus(l.debe);
      haber = haber.plus(l.haber);
    }
    if (redondear(debe).lte(0)) throw new BadRequestException('El asiento no tiene montos');
    if (!redondear(debe).equals(redondear(haber))) {
      throw new BadRequestException(`El asiento no cuadra: debe ${debe} ≠ haber ${haber}`);
    }

    // Las cuentas deben pertenecer al comercio.
    const ids = [...new Set(dto.lineas.map((l) => l.cuentaId))];
    const cuentas = await this.prisma.planCuenta.findMany({
      where: { id: { in: ids }, contribuyenteId },
      select: { id: true },
    });
    if (cuentas.length !== ids.length) {
      throw new BadRequestException('Una o más cuentas no pertenecen al comercio');
    }

    const asiento = await this.prisma.asiento.create({
      data: {
        contribuyenteId,
        fecha: new Date(dto.fecha),
        glosa: dto.glosa,
        origen: OrigenAsiento.MANUAL,
        lineas: {
          create: dto.lineas.map((l) => ({ cuentaId: l.cuentaId, debe: l.debe, haber: l.haber })),
        },
      },
      include: { lineas: true },
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId,
      ip,
      accion: 'asiento_manual',
      entidad: 'asiento',
      entidadId: asiento.id,
    });
    return asiento;
  }

  listarAsientos(actor: AuthenticatedUser) {
    return this.prisma.asiento.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      include: { lineas: { include: { cuenta: { select: { codigo: true, nombre: true } } } } },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new NotFoundException('Operación de contabilidad requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
