import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CondicionFiscal, EstatusDocumento, Prisma, TipoDocumento, TipoRetencion } from '@prisma/client';
import Decimal from 'decimal.js';
import { redondear } from 'src/common/fiscal/calculo-fiscal';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ImprentaService } from '../imprenta/imprenta.service';
import { ImprentaError } from '../imprenta/imprenta.types';
import {
  construirPayloadRetencionIslr,
  construirPayloadRetencionIva,
  DatosRetencionImprenta,
} from '../imprenta/mappers/retencion.mapper';
import { NumeracionService } from '../puntos-emision/numeracion.service';
import { EmitirRetencionDto, EmitirRetencionIslrDto } from './dto/emitir-retencion.dto';

const PORCENTAJE_IVA_DEFAULT = 75; // RN-129 (a confirmar revisor fiscal)
const PORCENTAJE_ISLR_DEFAULT = 3;

@Injectable()
export class RetencionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numeracion: NumeracionService,
    private readonly imprenta: ImprentaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  emitirIva(dto: EmitirRetencionDto, actor: AuthenticatedUser, ip?: string) {
    return this.emitir(TipoRetencion.IVA, dto, actor, ip);
  }

  emitirIslr(dto: EmitirRetencionIslrDto, actor: AuthenticatedUser, ip?: string) {
    return this.emitir(TipoRetencion.ISLR, dto, actor, ip);
  }

  private async emitir(
    tipo: TipoRetencion,
    dto: EmitirRetencionDto | EmitirRetencionIslrDto,
    actor: AuthenticatedUser,
    ip?: string,
  ) {
    const contribuyenteId = this.tenantId(actor);

    // RN-129: solo agentes de retención pueden emitir.
    const agente = await this.prisma.contribuyente.findUniqueOrThrow({
      where: { id: contribuyenteId },
    });
    if (!agente.agenteRetencion) {
      throw new ForbiddenException('El comercio no es agente de retención (RN-129)');
    }

    const compra = await this.prisma.compra.findFirst({
      where: { id: dto.compraId, contribuyenteId },
      include: { proveedor: true },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    // RN-127: la retención referencia la factura del proveedor (debe tener nro de control).
    if (!compra.numeroControl) {
      throw new BadRequestException(
        'La compra no tiene número de control de la factura del proveedor (RN-127)',
      );
    }

    const punto = await this.prisma.puntoEmision.findFirst({
      where: { id: dto.puntoEmisionId, contribuyenteId },
    });
    if (!punto) throw new BadRequestException('Punto de emisión inválido');

    const porcentaje = new Decimal(
      dto.porcentaje ?? (tipo === TipoRetencion.IVA ? PORCENTAJE_IVA_DEFAULT : PORCENTAJE_ISLR_DEFAULT),
    );
    // IVA: base = IVA de la compra. ISLR: base = base imponible de la compra.
    const base = redondear(tipo === TipoRetencion.IVA ? compra.ivaCredito : compra.base);
    // ISLR: impuesto retenido = base × % − sustraendo (personas naturales, decreto 1.808).
    const sustraendo =
      tipo === TipoRetencion.ISLR
        ? redondear((dto as EmitirRetencionIslrDto).sustraendo ?? 0)
        : new Decimal(0);
    const montoRetenido = Decimal.max(
      redondear(base.times(porcentaje).dividedBy(100)).minus(sustraendo),
      0,
    );

    const periodoYear = String(compra.fecha.getUTCFullYear());
    const periodoMonth = String(compra.fecha.getUTCMonth() + 1).padStart(2, '0');
    const ahora = new Date();
    const hora = ahora.toISOString().slice(11, 19);
    const tipoDoc =
      tipo === TipoRetencion.IVA ? TipoDocumento.RETENCION_IVA : TipoDocumento.RETENCION_ISLR;

    const creado = await this.prisma.$transaction(async (tx) => {
      const { numero } = await this.numeracion.siguiente(punto.id, tipoDoc, tx);
      const docNum = `${periodoYear}${periodoMonth}${String(numero).padStart(8, '0')}`;
      return tx.comprobanteRetencion.create({
        data: {
          contribuyenteId,
          compraId: compra.id,
          tipo,
          docNum,
          estatus: EstatusDocumento.NO_ENVIADO,
          periodoYear,
          periodoMonth,
          beneficiarioTerceroId: compra.proveedorTerceroId,
          facDocumentNum: compra.numeroFactura,
          facControlNum: compra.numeroControl as string,
          base: base.toFixed(2),
          porcentaje: porcentaje.toFixed(2),
          montoRetenido: montoRetenido.toFixed(2),
          conceptoIslr: tipo === TipoRetencion.ISLR ? (dto as EmitirRetencionIslrDto).concepto : null,
          sustraendo: sustraendo.toFixed(2),
          condicionFiscal:
            tipo === TipoRetencion.ISLR
              ? ((dto as EmitirRetencionIslrDto).condicionFiscal as CondicionFiscal)
              : null,
          fecha: ahora,
          hora,
        },
      });
    });

    return this.transmitir(creado.id, agente, compra, actor, ip);
  }

  private async transmitir(
    id: string,
    agente: { rif: string; razonSocial: string; domicilioFiscal: string | null },
    compra: { numeroFactura: string; numeroControl: string | null; total: Prisma.Decimal; fecha: Date; proveedor: { rif: string; nombre: string; direccion: string | null; email: string | null } },
    actor: AuthenticatedUser,
    ip?: string,
  ) {
    const r = await this.prisma.comprobanteRetencion.findUniqueOrThrow({ where: { id } });

    const datos: DatosRetencionImprenta & {
      totalFactura: number;
      base: number;
      porcentaje: number;
      montoRetenido: number;
    } = {
      docNum: r.docNum,
      periodoYear: r.periodoYear,
      periodoMonth: r.periodoMonth,
      fecha: r.fecha,
      hora: r.hora,
      beneficiario: {
        docType: compra.proveedor.rif.charAt(0),
        docId: compra.proveedor.rif.slice(1),
        nombre: compra.proveedor.nombre,
        direccion: compra.proveedor.direccion,
        email: compra.proveedor.email,
      },
      agente: {
        docType: agente.rif.charAt(0),
        docId: agente.rif.slice(1),
        nombre: agente.razonSocial,
        direccion: agente.domicilioFiscal,
        email: '',
      },
      facDate: compra.fecha,
      facDocumentNum: r.facDocumentNum,
      facControlNum: r.facControlNum,
      totalFactura: Number(compra.total),
      base: Number(r.base),
      porcentaje: Number(r.porcentaje),
      montoRetenido: Number(r.montoRetenido),
    };

    try {
      const resp =
        r.tipo === TipoRetencion.IVA
          ? await this.imprenta.generarRetencionIva(construirPayloadRetencionIva(datos))
          : await this.imprenta.generarRetencionIslr(
              construirPayloadRetencionIslr({
                ...datos,
                sustraendo: Number(r.sustraendo),
                concepto: r.conceptoIslr ?? '',
                retentionCode: '001',
              }),
            );
      const actualizado = await this.prisma.comprobanteRetencion.update({
        where: { id },
        data: { numeroControl: resp.numeroControl, estatus: EstatusDocumento.ENVIADO },
      });
      await this.audit(actor, ip, `emitir_retencion_${r.tipo.toLowerCase()}`, id, {
        docNum: r.docNum,
        numeroControl: resp.numeroControl,
      });
      return actualizado;
    } catch (e) {
      if (!(e instanceof ImprentaError)) throw e;
      await this.audit(actor, ip, `emitir_retencion_${r.tipo.toLowerCase()}_no_enviado`, id, {
        docNum: r.docNum,
        error: e.message,
      });
      return r; // NO_ENVIADO
    }
  }

  listar(actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    return this.prisma.comprobanteRetencion.findMany({
      where: { contribuyenteId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de retenciones requiere contexto de comercio');
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
      entidad: 'comprobante_retencion',
      entidadId,
      detalle,
    });
  }
}
