import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface RegistroAuditoriaInput {
  usuarioId?: string | null;
  contribuyenteId?: string | null;
  ip?: string | null;
  accion: string;
  entidad?: string | null;
  entidadId?: string | null;
  detalle?: Prisma.InputJsonValue;
}

/**
 * Registro de auditoría transversal (RN-004). Solo inserta: la tabla es
 * append-only y nunca se edita ni borra (U-L1). La auditoría no debe tumbar
 * la operación principal, por eso un fallo aquí se loguea pero no propaga.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Consulta del registro de auditoría, acotada por comercio (Sirumatek ve todo). */
  consultar(
    contribuyenteId: string | null,
    filtros: { accion?: string; entidad?: string } = {},
  ) {
    return this.prisma.registroAuditoria.findMany({
      where: {
        ...(contribuyenteId ? { contribuyenteId } : {}),
        accion: filtros.accion,
        entidad: filtros.entidad,
      },
      orderBy: { fechaHora: 'desc' },
      take: 100,
    });
  }

  async registrar(input: RegistroAuditoriaInput): Promise<void> {
    try {
      await this.prisma.registroAuditoria.create({
        data: {
          usuarioId: input.usuarioId ?? null,
          contribuyenteId: input.contribuyenteId ?? null,
          ip: input.ip ?? null,
          accion: input.accion,
          entidad: input.entidad ?? null,
          entidadId: input.entidadId ?? null,
          detalle: input.detalle,
        },
      });
    } catch (e) {
      this.logger.error(`No se pudo registrar auditoría (${input.accion})`, e as Error);
    }
  }
}
