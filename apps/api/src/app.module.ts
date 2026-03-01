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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 80,
      },
      {
        name: 'public_read',
        ttl: 60000,
        limit: 120,
      },
      {
        name: 'admin_auth',
        ttl: 300000,
        limit: 10,
      },
      {
        name: 'admin_api',
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    SecurityModule,
    ProfileModule,
    UpdatesModule,
    LockfileModule,
    ArtifactsModule,
    AdminModule,
  ],
})
export class AppModule {}
