import { Injectable } from '@nestjs/common';
import { Prisma, TipoDocumento } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface NumeroAsignado {
  numero: number;
  docNum: string; // formateado, p. ej. "00000504"
}

/**
 * Numeración correlativa por (punto de emisión, tipo de documento) — RN-006/RN-128.
 *
 * `siguiente` incrementa de forma ATÓMICA el contador y devuelve el nuevo número.
 * Para ser **sin saltos** (RN-006), debe llamarse DENTRO de la misma transacción
 * que crea el documento: si la emisión falla y hace rollback, el contador también
 * se revierte y el número no se "quema".
 */
@Injectable()
export class NumeracionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea los contadores (en 0) de todos los tipos para un punto de emisión nuevo. */
  async inicializarSecuencias(
    puntoEmisionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    await client.secuenciaDocumento.createMany({
      data: Object.values(TipoDocumento).map((tipo) => ({ puntoEmisionId, tipo })),
      skipDuplicates: true,
    });
  }

  /** Devuelve el siguiente número correlativo para (punto, tipo), incrementando atómicamente. */
  async siguiente(
    puntoEmisionId: string,
    tipo: TipoDocumento,
    tx?: Prisma.TransactionClient,
  ): Promise<NumeroAsignado> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    // UPDATE ... SET ultimo = ultimo + 1 RETURNING: atómico y serializado por fila.
    const seq = await client.secuenciaDocumento.update({
      where: { puntoEmisionId_tipo: { puntoEmisionId, tipo } },
      data: { ultimo: { increment: 1 } },
    });
    return { numero: seq.ultimo, docNum: this.formatear(seq.ultimo) };
  }

  /** Formato del doc_num interno: 8 dígitos con ceros a la izquierda. */
  formatear(numero: number): string {
    return String(numero).padStart(8, '0');
  }
}
