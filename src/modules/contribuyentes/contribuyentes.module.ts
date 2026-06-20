import { Module } from '@nestjs/common';
import { ContribuyentesController } from './contribuyentes.controller';
import { ContribuyentesService } from './contribuyentes.service';

@Module({
  controllers: [ContribuyentesController],
  providers: [ContribuyentesService],
})
export class ContribuyentesModule {}
