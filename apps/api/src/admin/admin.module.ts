import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthContextModule } from './auth/admin-auth-context.module';
import { AdminExarotonModule } from './exaroton/admin-exaroton.module';
import { AdminLauncherPairingModule } from './launcher/admin-launcher-pairing.module';
import { AdminMediaModule } from './media/admin-media.module';
import { AdminModsModule } from './mods/admin-mods.module';
import { AdminPublishModule } from './publish/admin-publish.module';
import { AdminSettingsModule } from './settings/admin-settings.module';

@Module({
  imports: [
    AdminAuthContextModule,
    AdminSettingsModule,
    AdminExarotonModule,
    AdminLauncherPairingModule,
    AdminModsModule,
    AdminPublishModule,
    AdminMediaModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
