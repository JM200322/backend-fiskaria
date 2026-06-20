import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';

/**
 * Módulo global de auditoría: expone AuditoriaService a toda la aplicación
 * (cualquier módulo puede registrar operaciones sensibles).
 */
@Global()
@Module({
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
