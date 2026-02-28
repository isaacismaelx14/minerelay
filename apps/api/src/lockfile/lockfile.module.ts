import { Module } from '@nestjs/common';
import { LockfileController } from './lockfile.controller';
import { LockfileService } from './lockfile.service';

@Module({
  controllers: [LockfileController],
  providers: [LockfileService],
})
export class LockfileModule {}
