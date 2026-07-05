import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrigenAsiento, Prisma, TipoCuenta } from '@prisma/client';
import Decimal from 'decimal.js';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ConfigCuentaDto, CrearAsientoDto, CrearCuentaDto } from './dto/contabilidad.dto';

interface LineaAutomatica {
  evento: string;
  debe?: Decimal.Value;
  haber?: Decimal.Value;
}

@Injectable()
export class ContabilidadService {
  private readonly logger = new Logger(ContabilidadService.name);

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

  /**
   * Genera un asiento automático (RN-107) resolviendo cada evento contable a su
   * cuenta vía ConfigCuentaContable. El plan de cuentas es opcional y sin
   * precarga (RN-135) — si el comercio no ha mapeado los eventos requeridos,
   * el asiento se omite en silencio (log) en vez de bloquear la venta/compra
   * que lo origina. Nunca lanza: degradación intencional, no un bug.
   */
  async registrarAutomatico(params: {
    contribuyenteId: string;
    fecha: Date;
    glosa: string;
    documentoRef?: string;
    lineas: LineaAutomatica[];
  }) {
    try {
      const activas = params.lineas.filter(
        (l) => new Decimal(l.debe ?? 0).gt(0) || new Decimal(l.haber ?? 0).gt(0),
      );
      if (activas.length === 0) return null;

      const eventos = [...new Set(activas.map((l) => l.evento))];
      const configs = await this.prisma.configCuentaContable.findMany({
        where: { contribuyenteId: params.contribuyenteId, evento: { in: eventos } },
      });
      if (configs.length !== eventos.length) {
        const faltantes = eventos.filter((e) => !configs.some((c) => c.evento === e));
        this.logger.warn(
          `Asiento automático omitido (${params.glosa}): sin cuenta configurada para [${faltantes.join(', ')}]`,
        );
        return null;
      }
      const cuentaPorEvento = new Map(configs.map((c) => [c.evento, c.cuentaId]));

      let debe = new Decimal(0);
      let haber = new Decimal(0);
      const lineasAsiento = activas.map((l) => {
        const d = redondear(l.debe ?? 0);
        const h = redondear(l.haber ?? 0);
        debe = debe.plus(d);
        haber = haber.plus(h);
        return { cuentaId: cuentaPorEvento.get(l.evento)!, debe: d.toFixed(2), haber: h.toFixed(2) };
      });
      if (!redondear(debe).equals(redondear(haber))) {
        this.logger.warn(`Asiento automático omitido (${params.glosa}): no cuadra (${debe} ≠ ${haber})`);
        return null;
      }

      return await this.prisma.asiento.create({
        data: {
          contribuyenteId: params.contribuyenteId,
          fecha: params.fecha,
          glosa: params.glosa,
          origen: OrigenAsiento.AUTOMATICO,
          documentoRef: params.documentoRef,
          lineas: { create: lineasAsiento },
        },
        include: { lineas: true },
      });
    } catch (e) {
      this.logger.error(`Error generando asiento automático (${params.glosa})`, e as Error);
      return null;
    }
  }

  /**
   * Estado de Resultados del período, derivado del Libro Diario (no de
   * DocumentoFiscal/Compra directamente) para tener una única fuente de verdad
   * contable. "Costo de Ventas" = compras del período (evento compras_gasto):
   * es una aproximación, NO PEPS/promedio ponderado — el modelo de datos no
   * lleva valuación de inventario por lote/costo histórico.
   */
  async estadoResultados(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const [lineas, configCosto] = await Promise.all([
      this.prisma.asientoLinea.findMany({
        where: { asiento: { contribuyenteId, fecha: { gte: desde, lt: hasta } } },
        include: { cuenta: { select: { id: true, tipo: true } } },
      }),
      this.prisma.configCuentaContable.findUnique({
        where: { contribuyenteId_evento: { contribuyenteId, evento: 'compras_gasto' } },
      }),
    ]);

    let ingresos = new Decimal(0);
    let costoVentas = new Decimal(0);
    let gastosOperativos = new Decimal(0);
    for (const l of lineas) {
      const monto = new Decimal(l.debe).minus(l.haber); // debe > haber = saldo deudor
      if (l.cuenta.tipo === TipoCuenta.INGRESO) {
        ingresos = ingresos.minus(monto); // los ingresos crecen en haber
      } else if (l.cuenta.tipo === TipoCuenta.GASTO) {
        if (configCosto && l.cuentaId === configCosto.cuentaId) costoVentas = costoVentas.plus(monto);
        else gastosOperativos = gastosOperativos.plus(monto);
      }
    }

    const utilidadBruta = ingresos.minus(costoVentas);
    const utilidadNeta = utilidadBruta.minus(gastosOperativos);

    return {
      periodo: `${year}-${String(month).padStart(2, '0')}`,
      ingresosOperacionales: redondear(ingresos).toFixed(2),
      costoVentas: redondear(costoVentas).toFixed(2),
      utilidadBruta: redondear(utilidadBruta).toFixed(2),
      gastosOperativos: redondear(gastosOperativos).toFixed(2),
      utilidadNeta: redondear(utilidadNeta).toFixed(2),
      notaCostoVentas: configCosto
        ? 'Costo de Ventas = compras del período (evento compras_gasto), no PEPS/promedio ponderado — el modelo no valúa inventario por costo histórico.'
        : 'Costo de Ventas no disponible: falta mapear el evento "compras_gasto" en Configuración de cuentas.',
    };
  }

  /**
   * Ratios financieros. Solvencia y margen neto se calculan con lo que el
   * modelo soporta (saldos por TipoCuenta). Liquidez corriente y rotación de
   * inventario vuelven `null` con nota: requieren sub-clasificar activo/pasivo
   * en corriente/no-corriente y valuar inventario, y el schema actual no lo
   * hace (RN-135: plan de cuentas plano, sin esa granularidad).
   */
  async ratiosFinancieros(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const resultado = await this.estadoResultados(actor, year, month);

    const saldos = await this.prisma.asientoLinea.findMany({
      where: { asiento: { contribuyenteId } }, // saldo acumulado histórico, no solo el período
      include: { cuenta: { select: { tipo: true } } },
    });
    let activo = new Decimal(0);
    let pasivo = new Decimal(0);
    for (const l of saldos) {
      const monto = new Decimal(l.debe).minus(l.haber);
      if (l.cuenta.tipo === TipoCuenta.ACTIVO) activo = activo.plus(monto);
      else if (l.cuenta.tipo === TipoCuenta.PASIVO) pasivo = pasivo.minus(monto);
    }

    const ingresos = new Decimal(resultado.ingresosOperacionales);
    const utilidadNeta = new Decimal(resultado.utilidadNeta);

    return {
      periodo: resultado.periodo,
      solvencia: pasivo.gt(0) ? redondear(activo.dividedBy(pasivo), 4).toNumber() : null,
      margenUtilidadNeta: ingresos.gt(0)
        ? redondear(utilidadNeta.dividedBy(ingresos).times(100), 2).toNumber()
        : null,
      liquidezCorriente: null as number | null,
      rotacionInventario: null as number | null,
      nota:
        'Liquidez corriente y rotación de inventario no son calculables con el modelo de datos actual: falta segregar cuentas corrientes/no-corrientes y valuar el inventario por costo.',
    };
  }

  /**
   * Libro Diario del período (Código de Comercio Art. 32): asientos en orden
   * cronológico con sus líneas debe/haber. Fuente: Asiento/AsientoLinea, la
   * misma que alimenta el Estado de Resultados — una sola fuente de verdad.
   */
  async libroDiario(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const asientos = await this.prisma.asiento.findMany({
      where: { contribuyenteId, fecha: { gte: desde, lt: hasta } },
      include: { lineas: { include: { cuenta: { select: { codigo: true, nombre: true } } } } },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });

    let totalDebe = new Decimal(0);
    let totalHaber = new Decimal(0);
    const filas = asientos.map((a, i) => {
      const lineas = a.lineas.map((l) => ({
        cuentaCodigo: l.cuenta.codigo,
        cuentaNombre: l.cuenta.nombre,
        debe: new Decimal(l.debe).toFixed(2),
        haber: new Decimal(l.haber).toFixed(2),
      }));
      const debe = lineas.reduce((acc, l) => acc.plus(l.debe), new Decimal(0));
      const haber = lineas.reduce((acc, l) => acc.plus(l.haber), new Decimal(0));
      totalDebe = totalDebe.plus(debe);
      totalHaber = totalHaber.plus(haber);
      return {
        nro: i + 1,
        fecha: a.fecha,
        glosa: a.glosa,
        origen: a.origen,
        lineas,
        totalPartida: debe.toFixed(2),
      };
    });

    return {
      periodo: `${year}-${String(month).padStart(2, '0')}`,
      asientos: filas,
      totales: { debe: totalDebe.toFixed(2), haber: totalHaber.toFixed(2) },
    };
  }

  /**
   * Libro Mayor del período (Código de Comercio Art. 34): movimientos por
   * cuenta con saldo inicial (arrastrado de asientos previos al período) y
   * saldo corrido. Solo incluye cuentas con saldo inicial o movimiento —
   * un plan de cuentas puede tener decenas de cuentas nunca usadas.
   */
  async libroMayor(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { desde, hasta } = this.rango(year, month);

    const [cuentas, previas, delPeriodo] = await Promise.all([
      this.prisma.planCuenta.findMany({ where: { contribuyenteId }, orderBy: { codigo: 'asc' } }),
      this.prisma.asientoLinea.findMany({
        where: { asiento: { contribuyenteId, fecha: { lt: desde } } },
        select: { cuentaId: true, debe: true, haber: true },
      }),
      this.prisma.asientoLinea.findMany({
        where: { asiento: { contribuyenteId, fecha: { gte: desde, lt: hasta } } },
        include: { asiento: { select: { fecha: true, glosa: true } } },
        orderBy: [{ asiento: { fecha: 'asc' } }],
      }),
    ]);

    const saldoInicialPorCuenta = new Map<string, Decimal>();
    for (const l of previas) {
      const acc = saldoInicialPorCuenta.get(l.cuentaId) ?? new Decimal(0);
      saldoInicialPorCuenta.set(l.cuentaId, acc.plus(l.debe).minus(l.haber));
    }
    const movimientosPorCuenta = new Map<string, typeof delPeriodo>();
    for (const l of delPeriodo) {
      const arr = movimientosPorCuenta.get(l.cuentaId) ?? [];
      arr.push(l);
      movimientosPorCuenta.set(l.cuentaId, arr);
    }

    const filas = cuentas
      .map((c) => {
        const saldoInicial = saldoInicialPorCuenta.get(c.id) ?? new Decimal(0);
        const movs = movimientosPorCuenta.get(c.id) ?? [];
        if (movs.length === 0 && saldoInicial.isZero()) return null;

        let saldo = saldoInicial;
        const movimientos = movs.map((l) => {
          saldo = saldo.plus(l.debe).minus(l.haber);
          return {
            fecha: l.asiento.fecha,
            glosa: l.asiento.glosa,
            debe: new Decimal(l.debe).toFixed(2),
            haber: new Decimal(l.haber).toFixed(2),
            saldo: saldo.toFixed(2),
          };
        });

        return {
          cuenta: { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo },
          saldoInicial: saldoInicial.toFixed(2),
          movimientos,
          saldoFinal: saldo.toFixed(2),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { periodo: `${year}-${String(month).padStart(2, '0')}`, cuentas: filas };
  }

  /**
   * Balance General (Libro de Inventarios y Balances, Código de Comercio
   * Art. 35): saldos acumulados a la fecha de corte, por cuenta, agrupados en
   * Activo/Pasivo/Patrimonio. La utilidad del ejercicio (aún no cerrada al
   * Patrimonio) se suma como línea propia — es el mismo número que Estado de
   * Resultados, no un cálculo paralelo.
   */
  async balanceGeneral(actor: AuthenticatedUser, year: number, month: number) {
    const contribuyenteId = this.tenantId(actor);
    const { hasta } = this.rango(year, month);

    const [cuentas, lineas, resultado] = await Promise.all([
      this.prisma.planCuenta.findMany({ where: { contribuyenteId }, orderBy: { codigo: 'asc' } }),
      this.prisma.asientoLinea.findMany({
        where: { asiento: { contribuyenteId, fecha: { lt: hasta } } },
        select: { cuentaId: true, debe: true, haber: true },
      }),
      this.estadoResultados(actor, year, month),
    ]);

    const saldoPorCuenta = new Map<string, Decimal>();
    for (const l of lineas) {
      const acc = saldoPorCuenta.get(l.cuentaId) ?? new Decimal(0);
      saldoPorCuenta.set(l.cuentaId, acc.plus(l.debe).minus(l.haber));
    }

    // Activo tiene saldo natural deudor; Pasivo/Patrimonio, acreedor (se invierte el signo).
    const seccion = (tipo: TipoCuenta, invertir: boolean) =>
      cuentas
        .filter((c) => c.tipo === tipo)
        .map((c) => {
          const crudo = saldoPorCuenta.get(c.id) ?? new Decimal(0);
          const saldo = invertir ? crudo.negated() : crudo;
          return { codigo: c.codigo, nombre: c.nombre, saldo: saldo.toFixed(2) };
        })
        .filter((c) => !new Decimal(c.saldo).isZero());

    const sum = (arr: { saldo: string }[]) =>
      arr.reduce((acc, c) => acc.plus(c.saldo), new Decimal(0));

    const activo = seccion(TipoCuenta.ACTIVO, false);
    const pasivo = seccion(TipoCuenta.PASIVO, true);
    const patrimonio = seccion(TipoCuenta.PATRIMONIO, true);
    const utilidadEjercicio = new Decimal(resultado.utilidadNeta);
    const totalPatrimonio = sum(patrimonio).plus(utilidadEjercicio);
    const totalPasivo = sum(pasivo);

    return {
      periodo: resultado.periodo,
      activo: { cuentas: activo, total: sum(activo).toFixed(2) },
      pasivo: { cuentas: pasivo, total: totalPasivo.toFixed(2) },
      patrimonio: {
        cuentas: patrimonio,
        utilidadEjercicio: utilidadEjercicio.toFixed(2),
        total: totalPatrimonio.toFixed(2),
      },
      totalPasivoMasPatrimonio: totalPasivo.plus(totalPatrimonio).toFixed(2),
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
