import { Module } from '@nestjs/common';
import { MunicipalesController } from './municipales.controller';
import { MunicipalesService } from './municipales.service';

@Module({
  controllers: [MunicipalesController],
  providers: [MunicipalesService],
})
export class MunicipalesModule {}
