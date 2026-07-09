import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Servicio de acceso a la base de datos vía Prisma.
 * Gestiona la conexión/desconexión con el ciclo de vida de la app.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Defensa en profundidad: passwordHash queda excluido de TODA consulta por
    // defecto, así ningún endpoint puede filtrarlo por accidente. Auth lo re-incluye
    // explícitamente (omit: { passwordHash: false }) solo donde compara la clave.
    super({ omit: { usuario: { passwordHash: true } } });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Conexión a PostgreSQL cerrada');
  }
}
