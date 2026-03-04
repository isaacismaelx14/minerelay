import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { PrismaModule } from './db/prisma.module';
import { LockfileModule } from './lockfile/lockfile.module';
import { ProfileModule } from './profile/profile.module';
import { UpdatesModule } from './updates/updates.module';

import { SecurityModule } from './security/security.module';
import { LauncherModule } from './launcher/launcher.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 8000,
      },
      {
        name: 'public_read',
        ttl: 60000,
        limit: 12000,
      },
      {
        name: 'admin_auth',
        ttl: 300000,
        limit: 1000,
      },
      {
        name: 'admin_api',
        ttl: 60000,
        limit: 6000,
      },
    ]),
    PrismaModule,
    SecurityModule,
    LauncherModule,
    ProfileModule,
    UpdatesModule,
    LockfileModule,
    ArtifactsModule,
    AdminModule,
  ],
})
export class AppModule {}
