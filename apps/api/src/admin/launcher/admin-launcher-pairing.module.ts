import { Module } from '@nestjs/common';
import { LauncherSecurityModule } from '../../launcher-security/launcher-security.module';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminLauncherPairingController } from './admin-launcher-pairing.controller';
import { AdminLauncherPairingContextService } from './admin-launcher-pairing-context.service';

@Module({
  imports: [AdminSharedModule, LauncherSecurityModule],
  controllers: [AdminLauncherPairingController],
  providers: [AdminLauncherPairingContextService],
  exports: [AdminLauncherPairingContextService],
})
export class AdminLauncherPairingModule {}
