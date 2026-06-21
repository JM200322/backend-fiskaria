import { Global, Module } from '@nestjs/common';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';

/**
 * Módulo global de tasas: el Facturador (y otros) podrán usar TasasService para
 * obtener la tasa vigente al emitir (RN-118).
 */
@Global()
@Module({
  controllers: [TasasController],
  providers: [TasasService],
  exports: [TasasService],
})
export class TasasModule {}
