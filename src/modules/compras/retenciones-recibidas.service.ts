import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoRetencion } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RegistrarRetencionRecibidaDto } from './dto/retencion-recibida.dto';

@Injectable()
export class RetencionesRecibidasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async registrar(dto: RegistrarRetencionRecibidaDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    const reg = await this.prisma.retencionRecibida.create({
      data: {
        contribuyenteId,
        tipo: dto.tipo as TipoRetencion,
        numero: dto.numero,
        fecha: new Date(dto.fecha),
        agenteRif: dto.agenteRif,
        agenteNombre: dto.agenteNombre,
        facturaRef: dto.facturaRef,
        base: dto.base,
        monto: dto.monto,
      },
    });
    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId,
      ip,
      accion: 'registrar_retencion_recibida',
      entidad: 'retencion_recibida',
      entidadId: reg.id,
      detalle: { tipo: dto.tipo, numero: dto.numero },
    });
    return reg;
  }

  listar(actor: AuthenticatedUser, tipo?: TipoRetencion) {
    return this.prisma.retencionRecibida.findMany({
      where: { contribuyenteId: this.tenantId(actor), tipo },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
