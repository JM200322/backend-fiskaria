import { Module } from '@nestjs/common';
import { TalonariosController } from './talonarios.controller';
import { TalonariosService } from './talonarios.service';

@Module({
  controllers: [TalonariosController],
  providers: [TalonariosService],
})
export class TalonariosModule {}
