import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstatusDocumento, MetodoPago, Prisma, TipoDocumento } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  calcularBaseLinea,
  calcularDocumento,
  calcularIgtf,
  redondear,
} from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { ImprentaService } from '../imprenta/imprenta.service';
import { ImprentaError, ImprentaRespuesta } from '../imprenta/imprenta.types';
import { construirPayloadFactura, DatosFacturaImprenta } from '../imprenta/mappers/factura.mapper';
import { construirPayloadGuia } from '../imprenta/mappers/guia.mapper';
import {
  construirPayloadNotaCredito,
  construirPayloadNotaDebito,
} from '../imprenta/mappers/nota.mapper';
import { NumeracionService } from '../puntos-emision/numeracion.service';
import { TasasService } from '../tasas/tasas.service';
import { EmitirFacturaDto, ItemFacturaDto, MetodoPagoDto } from './dto/emitir-factura.dto';
import { EmitirGuiaDto } from './dto/emitir-guia.dto';
import { EmitirNotaDto } from './dto/emitir-nota.dto';

const ETIQUETA_PAGO: Record<MetodoPagoDto, string> = {
  EFECTIVO_BS: 'Efectivo Bs.',
  DIVISAS: 'Divisas',
  PAGO_MOVIL: 'Pago Móvil',
  TARJETA: 'Tarjeta',
};

const incluir = { items: true, pagos: true, cliente: { select: { rif: true, nombre: true } } };

@Injectable()
export class FacturadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numeracion: NumeracionService,
    private readonly imprenta: ImprentaService,
    private readonly tasas: TasasService,
    private readonly auditoria: AuditoriaService,
    private readonly contabilidad: ContabilidadService,
  ) {}

  /** Usa la tasa enviada o, si falta, la del servicio de tasas (RN-118). */
  private async resolverTasa(tasaBcv?: number): Promise<number> {
    if (tasaBcv) return tasaBcv;
    const tasa = await this.tasas.obtenerTasa('USD');
    if (!tasa) throw new BadRequestException('No hay tasa BCV disponible');
    return Number(tasa);
  }

  async emitirFactura(dto: EmitirFacturaDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    // 1. Punto de emisión válido y del comercio.
    const punto = await this.prisma.puntoEmision.findFirst({
      where: { id: dto.puntoEmisionId, contribuyenteId },
    });
    if (!punto) throw new BadRequestException('Punto de emisión inválido');
    if (!punto.activo) throw new BadRequestException('El punto de emisión está inactivo');

    // 2. Cliente con RIF validado (F1 / RN-008).
    const cliente = await this.prisma.tercero.findFirst({
      where: { id: dto.clienteId, contribuyenteId, deletedAt: null },
    });
    if (!cliente || !cliente.esCliente) throw new NotFoundException('Cliente no encontrado');
    if (!cliente.rifValidado) {
      throw new UnprocessableEntityException('El cliente no tiene RIF validado (RN-008)');
    }

    // 3-4. Productos, construcción de líneas y cálculo fiscal.
    const { lineas, calc } = await this.prepararLineas(dto.items, contribuyenteId);

    // 5. Pagos e IGTF (RN-010). Los pagos deben cubrir el total (sin IGTF).
    const sumaPagos = dto.pagos.reduce((acc, p) => acc.plus(p.monto), new Decimal(0));
    if (!redondear(sumaPagos).equals(new Decimal(calc.total))) {
      throw new BadRequestException(
        `Los pagos (${redondear(sumaPagos).toFixed(2)}) no coinciden con el total (${calc.total})`,
      );
    }
    const montoDivisas = dto.pagos
      .filter((p) => p.esDivisa)
      .reduce((acc, p) => acc.plus(p.monto), new Decimal(0));
    const igtf = montoDivisas.gt(0) ? calcularIgtf(montoDivisas) : '0.00';
    const paymentMethod =
      dto.pagos.length === 1
        ? ETIQUETA_PAGO[dto.pagos[0].metodo]
        : 'Mixto';

    const ahora = new Date();
    const hora = ahora.toISOString().slice(11, 19); // HH:MM:SS
    const tasaBcv = await this.resolverTasa(dto.tasaBcv); // del servicio si no se envió

    // Factura a terceros (RN-126): se persiste el bloque third_party.
    const thirdParty = dto.tercero
      ? (() => {
          const d = dto.tercero.documento.toUpperCase().replace(/[\s-]/g, '');
          return {
            nombre: dto.tercero.nombre,
            tipoId: d.charAt(0),
            idNum: d.slice(1),
            direccion: dto.tercero.direccion ?? null,
            telefono: dto.tercero.telefono ?? null,
            email: dto.tercero.email ?? null,
          };
        })()
      : null;

    // 6. Transacción atómica: numeración + documento + descuento de stock (RN-006/121).
    const creado = await this.prisma.$transaction(async (tx) => {
      const { docNum } = await this.numeracion.siguiente(punto.id, TipoDocumento.FACTURA, tx);

      const doc = await tx.documentoFiscal.create({
        data: {
          contribuyenteId,
          puntoEmisionId: punto.id,
          tipo: TipoDocumento.FACTURA,
          docNum,
          estatus: EstatusDocumento.NO_ENVIADO,
          clienteTerceroId: cliente.id,
          fecha: ahora,
          hora,
          paymentMethod,
          subtotal: calc.subtotal,
          totalTax: calc.totalIva,
          totalWTaxes: calc.total,
          igtf,
          tasaBcv,
          desgloseIva: calc.desglose as unknown as Prisma.InputJsonValue,
          thirdParty: (thirdParty ?? undefined) as unknown as Prisma.InputJsonValue,
          items: {
            create: lineas.map((l) => ({
              productoId: l.producto.id,
              descripcion: l.producto.nombre,
              codigo: l.producto.codigo,
              cantidad: l.cantidad,
              costoUnit: l.costoUnit.toFixed(2),
              costoTotal: l.costoTotal.toFixed(2),
              taxElm: l.alicuota.gt(0) ? 'G' : 'E',
              taxPercentage: `${l.alicuota.toString()}%`,
            })),
          },
          pagos: {
            create: dto.pagos.map((p) => ({
              metodo: p.metodo as MetodoPago,
              monto: p.monto,
              esDivisa: p.esDivisa ?? false,
              referencia: p.referencia,
              banco: p.banco,
              lotePos: p.lotePos,
            })),
          },
        },
        include: incluir,
      });

      // Descuento de stock solo para almacenables (RN-121 / F16).
      for (const l of lineas) {
        if (l.producto.tipo === 'ALMACENABLE') {
          await tx.producto.update({
            where: { id: l.producto.id },
            data: { stock: { decrement: l.cantidad } },
          });
        }
      }
      return doc;
    });

    // 7. Libro Diario (RN-107): asiento automático, best-effort — nunca bloquea la venta.
    await this.contabilidad.registrarAutomatico({
      contribuyenteId,
      fecha: ahora,
      glosa: `Venta ${creado.docNum}`,
      documentoRef: creado.id,
      lineas: [
        { evento: 'caja_banco', debe: redondear(new Decimal(calc.total).plus(igtf)) },
        { evento: 'venta_ingreso', haber: calc.subtotal },
        { evento: 'iva_debito', haber: calc.totalIva },
        { evento: 'igtf', haber: igtf },
      ],
    });

    // 8. Transmisión a la Imprenta Digital (fuera de la transacción para no retener locks).
    return this.transmitir(creado.id, actor, ip);
  }

  /** Emite una Nota de Crédito (devolución/descuento) sobre una factura. */
  emitirNotaCredito(dto: EmitirNotaDto, actor: AuthenticatedUser, ip?: string) {
    return this.emitirNota(TipoDocumento.NOTA_CREDITO, dto, actor, ip);
  }

  /** Emite una Nota de Débito (cargo adicional) sobre una factura. */
  emitirNotaDebito(dto: EmitirNotaDto, actor: AuthenticatedUser, ip?: string) {
    return this.emitirNota(TipoDocumento.NOTA_DEBITO, dto, actor, ip);
  }

  /** Lógica común de NC/ND: referencia a factura, numeración propia, stock (NC), transmisión. */
  private async emitirNota(
    tipo: TipoDocumento, // NOTA_CREDITO | NOTA_DEBITO
    dto: EmitirNotaDto,
    actor: AuthenticatedUser,
    ip?: string,
  ) {
    const contribuyenteId = this.tenantId(actor);

    // Factura origen: debe existir, ser del comercio y estar emitida (RN-002, tener control).
    const factura = await this.prisma.documentoFiscal.findFirst({
      where: { id: dto.facturaOrigenId, contribuyenteId, tipo: TipoDocumento.FACTURA },
    });
    if (!factura) throw new NotFoundException('Factura origen no encontrada');
    if (factura.estatus !== EstatusDocumento.ENVIADO) {
      throw new BadRequestException(
        'La factura debe estar emitida (con número de control) para emitir una nota',
      );
    }

    const { lineas, calc } = await this.prepararLineas(dto.items, contribuyenteId);
    const ahora = new Date();
    const hora = ahora.toISOString().slice(11, 19);

    const creado = await this.prisma.$transaction(async (tx) => {
      const { docNum } = await this.numeracion.siguiente(factura.puntoEmisionId, tipo, tx);
      const doc = await tx.documentoFiscal.create({
        data: {
          contribuyenteId,
          puntoEmisionId: factura.puntoEmisionId,
          tipo,
          docNum,
          estatus: EstatusDocumento.NO_ENVIADO,
          clienteTerceroId: factura.clienteTerceroId,
          documentoOrigenId: factura.id, // trazabilidad (RN-002)
          reasonTo: dto.motivo,
          fecha: ahora,
          hora,
          paymentMethod: factura.paymentMethod,
          subtotal: calc.subtotal,
          totalTax: calc.totalIva,
          totalWTaxes: calc.total,
          igtf: '0.00', // las NC/ND no agregan IGTF (decisión a confirmar)
          tasaBcv: factura.tasaBcv,
          desgloseIva: calc.desglose as unknown as Prisma.InputJsonValue,
          items: {
            create: lineas.map((l) => ({
              productoId: l.producto.id,
              descripcion: l.producto.nombre,
              codigo: l.producto.codigo,
              cantidad: l.cantidad,
              costoUnit: l.costoUnit.toFixed(2),
              costoTotal: l.costoTotal.toFixed(2),
              taxElm: l.alicuota.gt(0) ? 'G' : 'E',
              taxPercentage: `${l.alicuota.toString()}%`,
            })),
          },
        },
      });

      // La Nota de Crédito por devolución reingresa stock (almacenables). La ND no mueve stock.
      if (tipo === TipoDocumento.NOTA_CREDITO) {
        for (const l of lineas) {
          if (l.producto.tipo === 'ALMACENABLE') {
            await tx.producto.update({
              where: { id: l.producto.id },
              data: { stock: { increment: l.cantidad } },
            });
          }
        }
      }
      return doc;
    });

    return this.transmitir(creado.id, actor, ip);
  }

  /** Reintenta la transmisión de un documento "No enviado" (RN-112). */
  async reintentar(id: string, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const doc = await this.prisma.documentoFiscal.findFirst({
      where: { id, contribuyenteId },
      include: { cliente: true },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (doc.estatus !== EstatusDocumento.NO_ENVIADO) {
      throw new BadRequestException('El documento no está en estatus "No enviado"');
    }
    return this.transmitir(doc.id, actor, ip, true);
  }

  /**
   * Reprocesa los documentos en estatus "No enviado" reintentando la transmisión a la
   * imprenta (RN-112). Lo invoca el job programado (sin usuario) y el endpoint manual.
   */
  async reprocesarNoEnviados(limite = 25): Promise<{ intentados: number; enviados: number }> {
    const pendientes = await this.prisma.documentoFiscal.findMany({
      where: { estatus: EstatusDocumento.NO_ENVIADO },
      orderBy: { createdAt: 'asc' },
      take: limite,
      select: { id: true },
    });
    let enviados = 0;
    for (const d of pendientes) {
      const doc = await this.transmitir(d.id, null, undefined, true);
      if (doc.estatus === EstatusDocumento.ENVIADO) enviados++;
    }
    return { intentados: pendientes.length, enviados };
  }

  async listar(actor: AuthenticatedUser, opts: { tipo?: TipoDocumento; estatus?: EstatusDocumento } = {}) {
    const contribuyenteId = this.tenantId(actor);
    return this.prisma.documentoFiscal.findMany({
      where: { contribuyenteId, tipo: opts.tipo, estatus: opts.estatus },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const doc = await this.prisma.documentoFiscal.findFirst({
      where: { id, contribuyenteId },
      include: incluir,
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    return doc;
  }

  /** Emite una Guía de Despacho (movimiento de mercancía, sin factura previa — RN-131). */
  async emitirGuiaDespacho(dto: EmitirGuiaDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    const punto = await this.prisma.puntoEmision.findFirst({
      where: { id: dto.puntoEmisionId, contribuyenteId },
    });
    if (!punto || !punto.activo) throw new BadRequestException('Punto de emisión inválido');

    const cliente = await this.prisma.tercero.findFirst({
      where: { id: dto.clienteId, contribuyenteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const { lineas, calc } = await this.prepararLineas(dto.items, contribuyenteId);
    const ahora = new Date();
    const hora = ahora.toISOString().slice(11, 19);
    const tasaBcv = await this.resolverTasa(dto.tasaBcv);

    const datosEnvio = {
      conductor: {
        nombre: dto.conductor.nombre,
        tipoId: dto.conductor.documento.charAt(0),
        idNum: dto.conductor.documento.replace(/[\s-]/g, '').slice(1),
      },
      vehiculo: dto.vehiculo,
      direccionOrigen: dto.direccionOrigen,
      direccionDestino: dto.direccionDestino,
      ordenCompra: dto.ordenCompra ?? '',
    };

    const creado = await this.prisma.$transaction(async (tx) => {
      const { docNum } = await this.numeracion.siguiente(punto.id, TipoDocumento.GUIA_DESPACHO, tx);
      // La guía NO descuenta stock ni lleva IGTF (no es una venta).
      return tx.documentoFiscal.create({
        data: {
          contribuyenteId,
          puntoEmisionId: punto.id,
          tipo: TipoDocumento.GUIA_DESPACHO,
          docNum,
          estatus: EstatusDocumento.NO_ENVIADO,
          clienteTerceroId: cliente.id,
          reasonTo: dto.motivo,
          fecha: ahora,
          hora,
          paymentMethod: 'N/A',
          subtotal: calc.subtotal,
          totalTax: calc.totalIva,
          totalWTaxes: calc.total,
          igtf: '0.00',
          tasaBcv,
          desgloseIva: calc.desglose as unknown as Prisma.InputJsonValue,
          datosEnvio: datosEnvio as unknown as Prisma.InputJsonValue,
          items: {
            create: lineas.map((l, i) => ({
              productoId: l.producto.id,
              descripcion: l.producto.nombre,
              codigo: l.producto.codigo,
              cantidad: l.cantidad,
              costoUnit: l.costoUnit.toFixed(2),
              costoTotal: l.costoTotal.toFixed(2),
              taxElm: l.alicuota.gt(0) ? 'G' : 'E',
              taxPercentage: `${l.alicuota.toString()}%`,
              pesoKg: dto.items[i].pesoKg,
            })),
          },
        },
      });
    });

    return this.transmitir(creado.id, actor, ip);
  }

  /** Productos → líneas (con alícuota por categoría fiscal/override) + cálculo fiscal. */
  private async prepararLineas(items: ItemFacturaDto[], contribuyenteId: string) {
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: items.map((i) => i.productoId) }, contribuyenteId, deletedAt: null },
      include: { categoriaFiscal: true },
    });
    const mapaProd = new Map(productos.map((p) => [p.id, p]));
    const lineas = items.map((item) => {
      const prod = mapaProd.get(item.productoId);
      if (!prod) throw new BadRequestException(`Producto inválido: ${item.productoId}`);
      const alicuota = new Decimal(prod.ivaOverride ?? prod.categoriaFiscal.alicuotaIva); // RN-102
      return {
        producto: prod,
        cantidad: item.cantidad,
        alicuota,
        costoUnit: redondear(prod.precio),
        costoTotal: calcularBaseLinea(item.cantidad, prod.precio),
      };
    });
    const calc = calcularDocumento(
      lineas.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.costoUnit, alicuota: l.alicuota })),
    );
    return { lineas, calc };
  }

  /**
   * Construye el payload según el tipo, llama a la imprenta y actualiza estatus/numeroControl.
   * Sirve para Factura, Nota de Crédito y Nota de Débito (y para reintentos).
   */
  private async transmitir(
    docId: string,
    actor: AuthenticatedUser | null,
    ip?: string,
    esReintento = false,
  ) {
    const doc = await this.prisma.documentoFiscal.findUniqueOrThrow({
      where: { id: docId },
      include: {
        items: true,
        pagos: true,
        cliente: true,
        documentoOrigen: { select: { docNum: true, numeroControl: true } },
      },
    });

    const cliente = {
      nombre: doc.cliente.nombre,
      tipoId: doc.cliente.tipoId,
      idNum: doc.cliente.rif.slice(1),
      direccion: doc.cliente.direccion,
      telefono: doc.cliente.telefono,
      email: doc.cliente.email,
    };
    const items = doc.items.map((it) => ({
      descripcion: it.descripcion,
      codigo: it.codigo,
      cantidad: Number(it.cantidad),
      costoUnit: Number(it.costoUnit),
      costoTotal: Number(it.costoTotal),
      taxElm: it.taxElm,
      taxPercentage: it.taxPercentage,
      pesoKg: Number(it.pesoKg ?? 0),
    }));
    const totales = {
      subtotal: Number(doc.subtotal),
      totalTax: Number(doc.totalTax),
      totalWTaxes: Number(doc.totalWTaxes),
      igtf: Number(doc.igtf),
      tasaBcv: Number(doc.tasaBcv),
    };
    const accionBase: Record<string, string> = {
      NOTA_CREDITO: 'nota_credito',
      NOTA_DEBITO: 'nota_debito',
      GUIA_DESPACHO: 'guia_despacho',
      FACTURA: 'factura',
    };
    const accion = accionBase[doc.tipo] ?? 'documento';

    try {
      let resp: ImprentaRespuesta;
      if (doc.tipo === TipoDocumento.FACTURA) {
        resp = await this.imprenta.generarFactura(
          construirPayloadFactura({
            docNum: doc.docNum,
            cliente,
            fecha: doc.fecha,
            hora: doc.hora,
            paymentMethod: doc.paymentMethod,
            notificarCliente: true,
            ...totales,
            items,
            tercero: doc.thirdParty as DatosFacturaImprenta['tercero'],
          }),
        );
      } else if (doc.tipo === TipoDocumento.GUIA_DESPACHO) {
        const envio = (doc.datosEnvio ?? {}) as {
          conductor: { nombre: string; tipoId: string; idNum: string };
          vehiculo: { placa: string; marca?: string; modelo?: string; color?: string };
          direccionOrigen: string;
          direccionDestino: string;
          ordenCompra?: string;
        };
        resp = await this.imprenta.generarGuiaDespacho(
          construirPayloadGuia({
            docNum: doc.docNum,
            cliente,
            conductor: envio.conductor,
            vehiculo: envio.vehiculo,
            ordenCompra: envio.ordenCompra,
            motivo: doc.reasonTo ?? '',
            direccionOrigen: envio.direccionOrigen,
            direccionDestino: envio.direccionDestino,
            fecha: doc.fecha,
            hora: doc.hora,
            subtotal: totales.subtotal,
            totalTax: totales.totalTax,
            totalWTaxes: totales.totalWTaxes,
            tasaBcv: totales.tasaBcv,
            items,
          }),
        );
      } else {
        const datosNota = {
          docNum: doc.docNum,
          cliente,
          fecha: doc.fecha,
          hora: doc.hora,
          motivo: doc.reasonTo ?? '',
          facturaDocNum: doc.documentoOrigen?.docNum ?? '',
          facturaNumeroControl: doc.documentoOrigen?.numeroControl ?? null,
          paymentMethod: doc.paymentMethod,
          ...totales,
          items,
        };
        resp =
          doc.tipo === TipoDocumento.NOTA_CREDITO
            ? await this.imprenta.generarNotaCredito(construirPayloadNotaCredito(datosNota))
            : await this.imprenta.generarNotaDebito(construirPayloadNotaDebito(datosNota));
      }

      const actualizado = await this.prisma.documentoFiscal.update({
        where: { id: docId },
        data: { numeroControl: resp.numeroControl, estatus: EstatusDocumento.ENVIADO },
        include: incluir,
      });
      await this.audit(
        actor,
        ip,
        `${esReintento ? 'reintentar' : 'emitir'}_${accion}`,
        docId,
        { docNum: doc.docNum, numeroControl: resp.numeroControl },
        doc.contribuyenteId,
      );
      return actualizado;
    } catch (e) {
      if (!(e instanceof ImprentaError)) throw e;
      // RN-112: la imprenta falló → el documento queda "No enviado" (no se pierde).
      await this.audit(
        actor,
        ip,
        `emitir_${accion}_no_enviado`,
        docId,
        { docNum: doc.docNum, error: e.message },
        doc.contribuyenteId,
      );
      return this.prisma.documentoFiscal.findUniqueOrThrow({ where: { id: docId }, include: incluir });
    }
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('La emisión requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }

  private audit(
    actor: AuthenticatedUser | null,
    ip: string | undefined,
    accion: string,
    entidadId: string,
    detalle?: Prisma.InputJsonValue,
    contribuyenteId?: string,
  ) {
    return this.auditoria.registrar({
      usuarioId: actor?.id ?? null,
      contribuyenteId: actor?.contribuyenteId ?? contribuyenteId ?? null,
      ip,
      accion,
      entidad: 'documento_fiscal',
      entidadId,
      detalle,
    });
  }
}
