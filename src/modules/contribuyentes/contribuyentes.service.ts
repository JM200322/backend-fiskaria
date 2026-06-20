import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PeriodoIva, TipoContribuyente } from '@prisma/client';
import { normalizarRif } from 'src/common/fiscal/rif.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SeniatService } from '../seniat/seniat.service';
import { ResultadoValidacionSeniat, SeniatValidationError } from '../seniat/seniat.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { CrearContribuyenteDto } from './dto/crear-contribuyente.dto';

@Injectable()
export class ContribuyentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seniat: SeniatService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Alta de un comercio (la realiza Sirumatek — RN-134). Valida el RIF ante el SENIAT (RN-101). */
  async crear(dto: CrearContribuyenteDto, actor: AuthenticatedUser, ip?: string) {
    const rif = normalizarRif(dto.rif);

    const existente = await this.prisma.contribuyente.findUnique({ where: { rif } });
    if (existente) {
      throw new BadRequestException(`Ya existe un contribuyente con el RIF ${rif}`);
    }

    let validacion: ResultadoValidacionSeniat | null = null;
    let validado = false;
    try {
      validacion = await this.seniat.validarRif(rif);
      validado = true;
    } catch (e) {
      if (e instanceof SeniatValidationError) {
        // RIF inválido o inexistente/inactivo: no se puede dar de alta (RN-101).
        if (e.code === 'RIF_INVALIDO') throw new BadRequestException(e.message);
        if (e.code === 'NO_ENCONTRADO') throw new UnprocessableEntityException(e.message);
        // SENIAT no disponible (503): se permite alta "pendiente de validación".
        // (Política por defecto — a confirmar con negocio, ver spec módulo 11.)
      } else {
        throw e;
      }
    }

    const tipo = this.mapTipo(validacion?.tipoContribuyente);
    const periodoIva =
      (dto.periodoIva as PeriodoIva | undefined) ?? this.derivarPeriodoIva(tipo);

    const contribuyente = await this.prisma.contribuyente.create({
      data: {
        rif,
        razonSocial: dto.razonSocial ?? validacion?.nombreCompleto ?? rif,
        tipoContribuyente: tipo,
        agenteRetencion: dto.agenteRetencion,
        periodoIva,
        domicilioFiscal: dto.domicilioFiscal,
        validado,
      },
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: contribuyente.id,
      ip,
      accion: 'crear_contribuyente',
      entidad: 'contribuyente',
      entidadId: contribuyente.id,
      detalle: { rif, validado },
    });

    return contribuyente;
  }

  /** Re-dispara la validación SENIAT de un contribuyente (p. ej. uno "pendiente") — RN-101. */
  async validar(id: string, actor: AuthenticatedUser, ip?: string) {
    const contribuyente = await this.obtener(id, actor);

    try {
      await this.seniat.validarRif(contribuyente.rif);
    } catch (e) {
      if (e instanceof SeniatValidationError) {
        if (e.code === 'NO_DISPONIBLE') throw new ServiceUnavailableException(e.message);
        throw new UnprocessableEntityException(e.message);
      }
      throw e;
    }

    const actualizado = await this.prisma.contribuyente.update({
      where: { id },
      data: { validado: true },
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: id,
      ip,
      accion: 'validar_contribuyente',
      entidad: 'contribuyente',
      entidadId: id,
    });

    return actualizado;
  }

  /** Obtiene un contribuyente respetando el scope multi-tenant (RN-122/125). */
  async obtener(id: string, actor: AuthenticatedUser) {
    this.assertScope(actor, id);
    const contribuyente = await this.prisma.contribuyente.findUnique({ where: { id } });
    if (!contribuyente) {
      throw new NotFoundException('Contribuyente no encontrado');
    }
    return contribuyente;
  }

  /** Lista contribuyentes: Sirumatek ve todos; un comercio solo el suyo. */
  async listar(actor: AuthenticatedUser) {
    if (actor.contribuyenteId) {
      return this.prisma.contribuyente.findMany({ where: { id: actor.contribuyenteId } });
    }
    return this.prisma.contribuyente.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Un usuario de comercio solo accede a su propio contribuyente; Sirumatek a cualquiera. */
  private assertScope(actor: AuthenticatedUser, contribuyenteId: string) {
    if (actor.contribuyenteId && actor.contribuyenteId !== contribuyenteId) {
      throw new ForbiddenException('No tiene acceso a este contribuyente');
    }
  }

  private mapTipo(tipo?: string): TipoContribuyente {
    switch ((tipo ?? '').toLowerCase()) {
      case 'especial':
        return TipoContribuyente.ESPECIAL;
      case 'formal':
        return TipoContribuyente.FORMAL;
      default:
        return TipoContribuyente.ORDINARIO;
    }
  }

  /** RN-130 (regla exacta a confirmar): Especial → quincenal; resto → mensual. */
  private derivarPeriodoIva(tipo: TipoContribuyente): PeriodoIva {
    return tipo === TipoContribuyente.ESPECIAL ? PeriodoIva.QUINCENAL : PeriodoIva.MENSUAL;
  }
}
