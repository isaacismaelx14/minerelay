import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SigningService } from '../security/signing.service';
import { ProfileLock, ProfileLockSchema } from '@mss/shared';

export interface SignedLockfileResponse {
  lock: ProfileLock;
  signature?: string;
  signatureAlgorithm?: 'ed25519';
  signatureKeyId?: string;
  signatureInput?: string;
  signedAt?: string;
}

@Injectable()
export class LockfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signing: SigningService,
  ) {}

  async getLock(
    profileId: string,
    version: number,
  ): Promise<SignedLockfileResponse> {
    const profileVersion = await this.prisma.profileVersion.findFirst({
      where: {
        profileId,
        version,
      },
    });

    if (!profileVersion) {
      throw new NotFoundException(
        `No lockfile found for profile '${profileId}' version '${version}'`,
      );
    }

    const lock = ProfileLockSchema.parse(profileVersion.lockJson);
    const signature = this.signing.signLockPayload(lock);

    return {
      lock,
      signature: signature?.signature,
      signatureAlgorithm: signature?.signatureAlgorithm,
      signatureKeyId: signature?.signatureKeyId,
      signatureInput: signature?.signatureInput,
      signedAt: signature?.signedAt,
    };
  }
}
