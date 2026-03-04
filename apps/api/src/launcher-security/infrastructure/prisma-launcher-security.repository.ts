import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../db/prisma.service';
import type {
  LauncherSecurityRepositoryPort,
} from '../ports/launcher-security-repository.port';

@Injectable()
export class PrismaLauncherSecurityRepository
  implements LauncherSecurityRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  createPairingClaim(input: {
    id: string;
    tokenHash: string;
    codeHash: string;
    expiresAt: Date;
    issuedBy: string | null;
  }) {
    return this.prisma.launcherPairingClaim.create({
      data: {
        id: input.id,
        tokenHash: input.tokenHash,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        issuedBy: input.issuedBy,
      },
    });
  }

  listPairingClaims(limit: number) {
    return this.prisma.launcherPairingClaim.findMany({
      take: limit,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async revokePairingClaim(id: string, now: Date) {
    const result = await this.prisma.launcherPairingClaim.updateMany({
      where: {
        id,
        consumedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
    return result.count > 0;
  }

  findClaimByTokenHash(tokenHash: string) {
    return this.prisma.launcherPairingClaim.findUnique({
      where: { tokenHash },
    });
  }

  findClaimByCodeHash(codeHash: string) {
    return this.prisma.launcherPairingClaim.findUnique({
      where: { codeHash },
    });
  }

  async consumeClaim(input: {
    claimId: string;
    consumedAt: Date;
    installationId: string;
    deviceHash: string;
  }) {
    const result = await this.prisma.launcherPairingClaim.updateMany({
      where: {
        id: input.claimId,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: input.consumedAt },
      },
      data: {
        consumedAt: input.consumedAt,
        consumedByInstallationId: input.installationId,
        consumedByDeviceHash: input.deviceHash,
      },
    });
    return result.count > 0;
  }

  createChallenge(input: { id: string; nonce: string; expiresAt: Date }) {
    return this.prisma.launcherChallenge.create({
      data: {
        id: input.id,
        nonce: input.nonce,
        expiresAt: input.expiresAt,
      },
    });
  }

  findChallengeById(id: string) {
    return this.prisma.launcherChallenge.findUnique({ where: { id } });
  }

  async consumeChallenge(id: string, consumedAt: Date) {
    const result = await this.prisma.launcherChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        expiresAt: { gt: consumedAt },
      },
      data: {
        consumedAt,
      },
    });
    return result.count > 0;
  }

  findTrustedDeviceByInstallationId(installationId: string) {
    return this.prisma.launcherTrustedDevice.findUnique({
      where: { installationId },
    });
  }

  async createTrustedDevice(input: {
    id: string;
    installationId: string;
    publicKeyHash: string;
    publicKeyBase64: string;
    deviceFingerprintHash: string;
    appVersion: string | null;
    platform: string | null;
    trustedAt: Date;
    lastSeenAt: Date;
  }) {
    await this.prisma.launcherTrustedDevice.create({
      data: {
        id: input.id,
        installationId: input.installationId,
        publicKeyHash: input.publicKeyHash,
        publicKeyBase64: input.publicKeyBase64,
        deviceFingerprintHash: input.deviceFingerprintHash,
        appVersion: input.appVersion,
        platform: input.platform,
        trustedAt: input.trustedAt,
        lastSeenAt: input.lastSeenAt,
      },
    });
  }

  async updateTrustedDevice(input: {
    installationId: string;
    publicKeyHash: string;
    publicKeyBase64: string;
    deviceFingerprintHash: string;
    appVersion: string | null;
    platform: string | null;
    rotatedAt: Date | null;
    lastSeenAt: Date;
  }) {
    await this.prisma.launcherTrustedDevice.update({
      where: { installationId: input.installationId },
      data: {
        publicKeyHash: input.publicKeyHash,
        publicKeyBase64: input.publicKeyBase64,
        deviceFingerprintHash: input.deviceFingerprintHash,
        appVersion: input.appVersion,
        platform: input.platform,
        rotatedAt: input.rotatedAt,
        lastSeenAt: input.lastSeenAt,
      },
    });
  }

  async markTrustedDeviceSeen(installationId: string, at: Date) {
    await this.prisma.launcherTrustedDevice.update({
      where: { installationId },
      data: {
        lastSeenAt: at,
      },
    });
  }

  async createSession(input: {
    id: string;
    tokenHash: string;
    tokenId: string;
    installationId: string;
    publicKeyBase64: string;
    userAgentHash: string;
    expiresAt: Date;
  }) {
    await this.prisma.launcherSession.create({
      data: {
        id: input.id,
        tokenHash: input.tokenHash,
        tokenId: input.tokenId,
        installationId: input.installationId,
        publicKeyBase64: input.publicKeyBase64,
        userAgentHash: input.userAgentHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  findSessionByTokenHash(tokenHash: string) {
    return this.prisma.launcherSession.findUnique({
      where: { tokenHash },
    });
  }

  async extendSession(sessionId: string, expiresAt: Date) {
    await this.prisma.launcherSession.update({
      where: { id: sessionId },
      data: {
        expiresAt,
      },
    });
  }

  async createNonce(input: {
    id: string;
    sessionId: string;
    nonce: string;
    expiresAt: Date;
  }) {
    try {
      await this.prisma.launcherSessionNonce.create({
        data: {
          id: input.id,
          sessionId: input.sessionId,
          nonce: input.nonce,
          expiresAt: input.expiresAt,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  async resetTrust(now: Date) {
    await this.prisma.$transaction([
      this.prisma.launcherTrustedDevice.updateMany({
        where: {
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
      this.prisma.launcherSession.updateMany({
        where: {
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          expiresAt: now,
        },
      }),
      this.prisma.launcherPairingClaim.updateMany({
        where: {
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);
  }

  async cleanup(now: Date) {
    await this.prisma.$transaction([
      this.prisma.launcherChallenge.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }],
        },
      }),
      this.prisma.launcherSessionNonce.deleteMany({
        where: {
          expiresAt: { lte: now },
        },
      }),
      this.prisma.launcherSession.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
        },
      }),
      this.prisma.launcherPairingClaim.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: now } },
            { consumedAt: { not: null } },
            { revokedAt: { not: null } },
          ],
        },
      }),
    ]);
  }
}
