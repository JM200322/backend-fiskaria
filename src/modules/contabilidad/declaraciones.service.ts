import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, TipoRetencion } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LibrosService } from './libros.service';

/**
 * "Declarar período" (CT5/RN-108): congela el snapshot de los libros y el resumen del
 * período y lo marca como DECLARADA. NO declara ante el SENIAT (eso es manual en el
 * portal); el usuario puede registrar luego la referencia de la planilla.
 */
@Injectable()
export class DeclaracionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly libros: LibrosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async declararIva(year: number, month: number, actor: AuthenticatedUser, ip?: string, referencia?: string) {
    const contribuyenteId = this.tenantId(actor);
    const periodo = `${year}-${String(month).padStart(2, '0')}`;

    const existente = await this.prisma.declaracion.findUnique({
      where: { contribuyenteId_tipo_periodo: { contribuyenteId, tipo: TipoRetencion.IVA, periodo } },
    });
    if (existente) {
      throw new ConflictException(`El período ${periodo} ya fue declarado (IVA)`);
    }

    // Paquete: snapshot inmutable de libros + resumen al momento de declarar.
    const [ventas, compras, resumen] = await Promise.all([
      this.libros.libroVentas(actor, year, month),
      this.libros.libroCompras(actor, year, month),
      this.libros.resumenIva(actor, year, month),
    ]);

    const declaracion = await this.prisma.declaracion.create({
      data: {
        contribuyenteId,
        tipo: TipoRetencion.IVA,
        periodo,
        debitoFiscal: resumen.debitoFiscal,
        creditoFiscal: resumen.creditoFiscal,
        retenciones: resumen.retencionesIva,
        montoADeclarar: resumen.montoADeclarar,
        referencia,
        paquete: { ventas, compras, resumen } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId,
      ip,
      accion: 'declarar_periodo_iva',
      entidad: 'declaracion',
      entidadId: declaracion.id,
      detalle: { periodo, montoADeclarar: resumen.montoADeclarar },
    });

    // No devolvemos el paquete completo (pesado); se consulta por id.
    const { paquete: _, ...resto } = declaracion;
    return resto;
  }

  listar(actor: AuthenticatedUser) {
    return this.prisma.declaracion.findMany({
      where: { contribuyenteId: this.tenantId(actor) },
      omit: { paquete: true },
      orderBy: { periodo: 'desc' },
    });
  }

  async obtener(id: string, actor: AuthenticatedUser) {
    const d = await this.prisma.declaracion.findFirst({
      where: { id, contribuyenteId: this.tenantId(actor) },
    });
    if (!d) throw new BadRequestException('Declaración no encontrada');
    return d; // incluye el paquete (snapshot completo)
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación de declaraciones requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
