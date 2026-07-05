import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasaDiaria } from './tasa-diaria.entity';
import { TasasController } from './tasas.controller';
import { TasasService } from './tasas.service';

@Module({
  imports: [TypeOrmModule.forFeature([TasaDiaria])],
  controllers: [TasasController],
  providers: [TasasService],
  exports: [TasasService],
})
export class TasasModule {}
