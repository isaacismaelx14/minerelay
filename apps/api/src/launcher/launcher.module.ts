import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { LauncherSecurityModule } from '../launcher-security/launcher-security.module';
import { LauncherController } from './launcher.controller';
import { LauncherAuthGuard } from './launcher-auth.guard';
import { LauncherService } from './launcher.service';

@Module({
  imports: [AdminModule, LauncherSecurityModule],
  controllers: [LauncherController],
  providers: [LauncherService, LauncherAuthGuard],
  exports: [LauncherService],
})
export class LauncherModule {}
