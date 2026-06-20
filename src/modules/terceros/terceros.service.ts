import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { esRifFormatoValido, normalizarRif } from 'src/common/fiscal/rif.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SeniatService } from '../seniat/seniat.service';
import { SeniatValidationError } from '../seniat/seniat.types';
import { ActualizarTerceroDto } from './dto/actualizar-tercero.dto';
import { CrearTerceroDto } from './dto/crear-tercero.dto';

@Injectable()
export class TercerosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seniat: SeniatService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Alta de un tercero. Valida el RIF contra el SENIAT (best-effort) — RN-008. */
  async crear(dto: CrearTerceroDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const rif = normalizarRif(dto.rif);
    if (!esRifFormatoValido(rif)) {
      throw new BadRequestException(`Formato de RIF inválido: ${dto.rif}`);
    }

    const { esCliente, esProveedor } = this.normalizarRoles(dto.esCliente, dto.esProveedor);

    // CL-L1: si el RIF ya existe en el comercio, no se duplica: se fusionan los roles.
    const existente = await this.prisma.tercero.findUnique({
      where: { contribuyenteId_rif: { contribuyenteId, rif } },
    });
    if (existente) {
      const actualizado = await this.prisma.tercero.update({
        where: { id: existente.id },
        data: {
          esCliente: existente.esCliente || esCliente,
          esProveedor: existente.esProveedor || esProveedor,
          nombre: dto.nombre ?? existente.nombre,
          direccion: dto.direccion ?? existente.direccion,
          telefono: dto.telefono ?? existente.telefono,
          email: dto.email ?? existente.email,
          deletedAt: null,
        },
      });
      await this.audit(actor, ip, 'actualizar_tercero', actualizado.id, { motivo: 'merge_roles' });
      return actualizado;
    }

    // Validación de RIF (best-effort): no bloquea el alta, pero marca rifValidado.
    let rifValidado = false;
    let nombreSeniat: string | undefined;
    try {
      const r = await this.seniat.validarRif(rif);
      rifValidado = true;
      nombreSeniat = r.nombreCompleto;
    } catch (e) {
      if (!(e instanceof SeniatValidationError)) throw e;
      // RIF no validado (inexistente, inválido o SENIAT caído): se crea igual, sin validar.
    }

    const tercero = await this.prisma.tercero.create({
      data: {
        contribuyenteId,
        rif,
        tipoId: rif.charAt(0),
        nombre: dto.nombre ?? nombreSeniat ?? rif,
        direccion: dto.direccion,
        telefono: dto.telefono,
        email: dto.email,
        esCliente,
        esProveedor,
        rifValidado,
      },
    });
    await this.audit(actor, ip, 'crear_tercero', tercero.id, { rif, rifValidado });
    return tercero;
  }

  /** Valida (o revalida) el RIF de un tercero contra el SENIAT — RN-008. */
  async validarRif(id: string, actor: AuthenticatedUser, ip?: string) {
    const tercero = await this.obtener(id, actor);
    try {
      await this.seniat.validarRif(tercero.rif);
    } catch (e) {
      if (e instanceof SeniatValidationError) {
        if (e.code === 'NO_DISPONIBLE') throw new ServiceUnavailableException(e.message);
        if (e.code === 'RIF_INVALIDO') throw new BadRequestException(e.message);
        throw new UnprocessableEntityException(e.message); // NO_ENCONTRADO
      }
      throw e;
    }
    const actualizado = await this.prisma.tercero.update({
      where: { id },
      data: { rifValidado: true },
    });
    await this.audit(actor, ip, 'validar_rif_tercero', id);
    return actualizado;
  }

  /** Lista terceros del comercio, con filtro por tipo y búsqueda por nombre/RIF. */
  async listar(actor: AuthenticatedUser, tipo?: 'cliente' | 'proveedor', q?: string) {
    const contribuyenteId = this.tenantId(actor);
    const where: Prisma.TerceroWhereInput = { contribuyenteId, deletedAt: null };
    if (tipo === 'cliente') where.esCliente = true;
    if (tipo === 'proveedor') where.esProveedor = true;
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { rif: { contains: normalizarRif(q), mode: 'insensitive' } },
      ];
    }
    return this.prisma.tercero.findMany({ where, orderBy: { nombre: 'asc' }, take: 100 });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const tercero = await this.prisma.tercero.findFirst({
      where: { id, contribuyenteId, deletedAt: null },
    });
    if (!tercero) throw new NotFoundException('Tercero no encontrado');
    return tercero;
  }

  async actualizar(id: string, dto: ActualizarTerceroDto, actor: AuthenticatedUser, ip?: string) {
    await this.obtener(id, actor); // valida scope/existencia
    const data: Prisma.TerceroUpdateInput = {
      nombre: dto.nombre,
      direccion: dto.direccion,
      telefono: dto.telefono,
      email: dto.email,
    };
    if (dto.esCliente !== undefined || dto.esProveedor !== undefined) {
      const roles = this.normalizarRoles(dto.esCliente, dto.esProveedor);
      data.esCliente = roles.esCliente;
      data.esProveedor = roles.esProveedor;
    }
    const actualizado = await this.prisma.tercero.update({ where: { id }, data });
    await this.audit(actor, ip, 'actualizar_tercero', id);
    return actualizado;
  }

  /** Los terceros pertenecen a un comercio; se requiere contexto de contribuyente. */
  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de terceros requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }

  /** Al menos un rol debe ser true; por defecto, cliente. */
  private normalizarRoles(esCliente?: boolean, esProveedor?: boolean) {
    if (esCliente === undefined && esProveedor === undefined) {
      return { esCliente: true, esProveedor: false };
    }
    const c = esCliente ?? false;
    const p = esProveedor ?? false;
    if (!c && !p) {
      throw new BadRequestException('El tercero debe ser cliente y/o proveedor');
    }
    return { esCliente: c, esProveedor: p };
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
      entidad: 'tercero',
      entidadId,
      detalle,
    });
  }
}
