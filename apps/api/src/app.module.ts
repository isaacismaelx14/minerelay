import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { PrismaModule } from './db/prisma.module';
import { LockfileModule } from './lockfile/lockfile.module';
import { ProfileModule } from './profile/profile.module';
import { UpdatesModule } from './updates/updates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    ProfileModule,
    UpdatesModule,
    LockfileModule,
    ArtifactsModule,
    AdminModule,
  ],
})
export class AppModule {}
