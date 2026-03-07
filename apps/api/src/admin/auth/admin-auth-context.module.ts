import { Module } from '@nestjs/common';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthContextService } from './admin-auth-context.service';

@Module({
  imports: [AdminSharedModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthContextService],
  exports: [AdminAuthContextService],
})
export class AdminAuthContextModule {}
