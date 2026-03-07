import { Module } from '@nestjs/common';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminExarotonModule } from '../exaroton/admin-exaroton.module';
import { AdminModsModule } from '../mods/admin-mods.module';
import { AdminAppSettingsStoreService } from './admin-app-settings-store.service';
import { AdminBootstrapAssemblerService } from './admin-bootstrap-assembler.service';
import { AdminDraftService } from './admin-draft.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsContextService } from './admin-settings-context.service';

@Module({
  imports: [AdminSharedModule, AdminExarotonModule, AdminModsModule],
  controllers: [AdminSettingsController],
  providers: [
    AdminSettingsContextService,
    AdminAppSettingsStoreService,
    AdminDraftService,
    AdminBootstrapAssemblerService,
  ],
  exports: [AdminSettingsContextService],
})
export class AdminSettingsModule {}
