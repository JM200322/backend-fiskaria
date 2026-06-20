import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo global de categorías fiscales (determinan el IVA). */
  listarFiscales() {
    return this.prisma.categoriaFiscal.findMany({ orderBy: { nombre: 'asc' } });
  }

  /** Categorías comerciales del comercio (solo organizativas). */
  listarComerciales(actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    return this.prisma.categoriaComercial.findMany({
      where: { contribuyenteId },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearComercial(nombre: string, actor: AuthenticatedUser) {
    const contribuyenteId = this.tenantId(actor);
    const existe = await this.prisma.categoriaComercial.findFirst({
      where: { contribuyenteId, nombre },
    });
    if (existe) throw new BadRequestException('Ya existe esa categoría comercial');
    return this.prisma.categoriaComercial.create({ data: { contribuyenteId, nombre } });
  }

  private tenantId(actor: AuthenticatedUser): string {
    if (!actor.contribuyenteId) {
      throw new BadRequestException('Operación requiere contexto de comercio');
    }
    return actor.contribuyenteId;
  }
}
