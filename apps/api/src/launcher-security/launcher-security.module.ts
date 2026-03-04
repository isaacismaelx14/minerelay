import { Module } from '@nestjs/common';
import { PrismaModule } from '../db/prisma.module';
import { LauncherSecurityUseCases } from './application/launcher-security.use-cases';
import {
  LAUNCHER_SECURITY_REPOSITORY,
} from './ports/launcher-security-repository.port';
import { PrismaLauncherSecurityRepository } from './infrastructure/prisma-launcher-security.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    LauncherSecurityUseCases,
    PrismaLauncherSecurityRepository,
    {
      provide: LAUNCHER_SECURITY_REPOSITORY,
      useExisting: PrismaLauncherSecurityRepository,
    },
  ],
  exports: [LauncherSecurityUseCases],
})
export class LauncherSecurityModule {}
