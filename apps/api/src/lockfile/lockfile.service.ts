import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { ProfileLock, ProfileLockSchema } from '@mvl/shared';

@Injectable()
export class LockfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getLock(profileId: string, version: number): Promise<ProfileLock> {
    const lock = await this.prisma.profileVersion.findFirst({
      where: {
        profileId,
        version,
      },
    });

    if (!lock) {
      throw new NotFoundException(`No lockfile found for profile '${profileId}' version '${version}'`);
    }

    return ProfileLockSchema.parse(lock.lockJson);
  }
}
