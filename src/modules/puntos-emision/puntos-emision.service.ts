import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarPuntoEmisionDto } from './dto/actualizar-punto-emision.dto';
import { CrearPuntoEmisionDto } from './dto/crear-punto-emision.dto';
import { NumeracionService } from './numeracion.service';

@Injectable()
export class PuntosEmisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numeracion: NumeracionService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async crear(dto: CrearPuntoEmisionDto, actor: AuthenticatedUser, ip?: string) {
    const contribuyenteId = this.tenantId(actor);

    const duplicado = await this.prisma.puntoEmision.findUnique({
      where: { contribuyenteId_codigo: { contribuyenteId, codigo: dto.codigo } },
    });
    if (duplicado) {
      throw new BadRequestException(`Ya existe un punto de emisión con el código ${dto.codigo}`);
    }

    // Crea el punto y sus contadores (uno por tipo de documento) en una transacción.
    const punto = await this.prisma.$transaction(async (tx) => {
      const p = await tx.puntoEmision.create({
        data: { contribuyenteId, codigo: dto.codigo, nombre: dto.nombre },
      });
      await this.numeracion.inicializarSecuencias(p.id, tx);
      return p;
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId,
      ip,
      accion: 'crear_punto_emision',
      entidad: 'punto_emision',
      entidadId: punto.id,
      detalle: { codigo: dto.codigo },
    });
    return punto;
  }

  listar(actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    return this.prisma.puntoEmision.findMany({
      where: { contribuyenteId },
      orderBy: { codigo: 'asc' },
    });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const punto = await this.prisma.puntoEmision.findFirst({
      where: { id, contribuyenteId },
      include: { secuencias: { select: { tipo: true, ultimo: true } } },
    });
    if (!punto) throw new NotFoundException('Punto de emisión no encontrado');
    return punto;
  }

  async actualizar(
    id: string,
    dto: ActualizarPuntoEmisionDto,
    actor: AuthenticatedUser,
    ip?: string,
  ) {
    await this.obtener(id, actor); // valida scope/existencia
    const punto = await this.prisma.puntoEmision.update({
      where: { id },
      data: { nombre: dto.nombre, activo: dto.activo },
    });
    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      ip,
      accion: 'actualizar_punto_emision',
      entidad: 'punto_emision',
      entidadId: id,
    });
    return punto;
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de puntos de emisión requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
