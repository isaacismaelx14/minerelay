import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminSessionGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminSessionService } from './auth/admin-session.service';
import { AdminCsrfGuard } from './auth/admin-csrf.guard';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminSessionGuard,
    AdminAuthService,
    AdminSessionService,
    AdminCsrfGuard,
  ],
  exports: [AdminService],
})
export class AdminModule {}
