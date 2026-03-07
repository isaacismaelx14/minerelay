import { Module } from '@nestjs/common';
import { ArtifactsModule } from '../artifacts/artifacts.module';
import { LauncherSecurityModule } from '../launcher-security/launcher-security.module';
import { AdminSessionGuard } from './admin.guard';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminSessionService } from './auth/admin-session.service';
import { AdminCsrfGuard } from './auth/admin-csrf.guard';
import { BundleSandboxClient } from './bundle-sandbox.client';
import { AdminCommonModule } from './common/admin-common.module';
import { CoreModPolicyService } from './core-mod-policy.service';
import { FancyPreviewAssemblerService } from './fancy-preview-assembler.service';
import { ExarotonApiClient } from './exaroton/exaroton-api.client';

@Module({
  imports: [ArtifactsModule, LauncherSecurityModule, AdminCommonModule],
  providers: [
    AdminSessionGuard,
    AdminAuthService,
    AdminSessionService,
    AdminCsrfGuard,
    BundleSandboxClient,
    ExarotonApiClient,
    CoreModPolicyService,
    FancyPreviewAssemblerService,
  ],
  exports: [
    AdminCommonModule,
    AdminSessionGuard,
    AdminAuthService,
    AdminSessionService,
    AdminCsrfGuard,
    BundleSandboxClient,
    ExarotonApiClient,
    CoreModPolicyService,
    FancyPreviewAssemblerService,
  ],
})
export class AdminSharedModule {}
