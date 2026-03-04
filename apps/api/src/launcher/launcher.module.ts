import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { LauncherController } from './launcher.controller';
import { LauncherAuthGuard } from './launcher-auth.guard';
import { LauncherService } from './launcher.service';

@Module({
  imports: [AdminModule],
  controllers: [LauncherController],
  providers: [LauncherService, LauncherAuthGuard],
})
export class LauncherModule {}
