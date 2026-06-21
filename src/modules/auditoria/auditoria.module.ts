import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

/**
 * Módulo global de auditoría: expone AuditoriaService a toda la aplicación
 * (cualquier módulo puede registrar operaciones sensibles) y la consulta del registro.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
