import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminSessionGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminSessionService } from './auth/admin-session.service';
import { AdminCsrfGuard } from './auth/admin-csrf.guard';
import { BundleSandboxClient } from './bundle-sandbox.client';
import { CoreModPolicyService } from './core-mod-policy.service';
import { FancyPreviewAssemblerService } from './fancy-preview-assembler.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminSessionGuard,
    AdminAuthService,
    AdminSessionService,
    AdminCsrfGuard,
    BundleSandboxClient,
    CoreModPolicyService,
    FancyPreviewAssemblerService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
