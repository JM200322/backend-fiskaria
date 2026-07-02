import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CrearTalonarioDto } from './dto/crear-talonario.dto';

@Injectable()
export class TalonariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Registra un rango de números de control autorizado por el SENIAT (Providencia
   * 00071) para talonarios de contingencia. Valida que no se solape con un rango
   * activo existente de la misma serie — el numeroControl jamás puede duplicarse.
   */
  async crear(dto: CrearTalonarioDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);
    if (dto.hasta < dto.desde) {
      throw new BadRequestException('"hasta" debe ser mayor o igual a "desde"');
    }

    const talonario = await this.prisma.$transaction(async (tx) => {
      // Solape: cualquier rango activo de la misma serie que no quede completamente
      // antes o completamente después del nuevo rango.
      const solapado = await tx.talonarioAutorizado.findFirst({
        where: {
          contribuyenteId,
          serie: dto.serie,
          activo: true,
          desde: { lte: dto.hasta },
          hasta: { gte: dto.desde },
        },
      });
      if (solapado) {
        throw new BadRequestException(
          `El rango se solapa con el talonario existente ${solapado.desde}–${solapado.hasta} (serie ${dto.serie})`,
        );
      }

      return tx.talonarioAutorizado.create({
        data: {
          contribuyenteId,
          serie: dto.serie,
          desde: dto.desde,
          hasta: dto.hasta,
          consecutivoActual: dto.desde,
          providenciaNum: dto.providenciaNum,
        },
      });
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId,
      ip,
      accion: 'crear_talonario',
      entidad: 'talonario_autorizado',
      entidadId: talonario.id,
      detalle: { serie: dto.serie, desde: dto.desde, hasta: dto.hasta },
    });

    return talonario;
  }

  async listar(actor: AuthenticatedUser) {
    return this.prisma.talonarioAutorizado.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      orderBy: [{ activo: 'desc' }, { serie: 'asc' }, { desde: 'asc' }],
    });
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de talonarios requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
