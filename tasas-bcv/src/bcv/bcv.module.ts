import { Module } from '@nestjs/common';
import { BcvSyncService } from './bcv-sync.service';

@Module({
  providers: [BcvSyncService],
  exports: [BcvSyncService],
})
export class BcvModule {}
