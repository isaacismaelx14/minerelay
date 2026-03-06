import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../db/prisma.service';
import { SigningService } from '../security/signing.service';
import {
  FancyMenuSettingsSchema,
  ProfileMetadataResponse,
  ProfileMetadataResponseSchema,
} from '@minerelay/shared';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly signing: SigningService,
  ) {}

  async getDefaultProfile(): Promise<ProfileMetadataResponse> {
    const serverId = this.config.get<string>('SERVER_ID') ?? 'mvl';
    return this.getProfile(serverId);
  }

  async getProfile(serverId: string): Promise<ProfileMetadataResponse> {
    const [server, latest] = await Promise.all([
      this.prisma.server.findUnique({
        where: { id: serverId },
      }),
      this.prisma.profileVersion.findFirst({
        where: { serverId },
        orderBy: { version: 'desc' },
      }),
    ]);

    if (!server || !latest) {
      throw new NotFoundException(
        `No profile version found for server '${serverId}'`,
      );
    }

    const allowedMinecraftVersions = Array.from(
      new Set([...server.allowedMinecraftVersions, latest.minecraftVersion]),
    );
    const lockFancyMenu = this.extractFancyMenu(latest.lockJson);
    const serverFancyMenu = this.extractFancyMenu(server.fancyMenuSettings);
    const profileFancyMenu = this.extractFancyMenu(latest.fancyMenuSettings);
    const fancyMenu =
      profileFancyMenu ?? serverFancyMenu ?? lockFancyMenu ?? undefined;
    const fancyMenuEnabled =
      latest.fancyMenuEnabled ||
      server.fancyMenuEnabled ||
      fancyMenu?.enabled === true;

    const unsignedPayload = {
      profileId: latest.profileId,
      version: latest.version,
      minecraftVersion: latest.minecraftVersion,
      loader: latest.loader,
      loaderVersion: latest.loaderVersion,
      lockUrl: this.normalizeLockUrl(latest.lockUrl),
      serverName: latest.defaultServerName || server.name,
      serverAddress: latest.defaultServerAddress || server.address,
      allowedMinecraftVersions,
      fancyMenuEnabled,
      fancyMenu,
    };

    const signature = this.signing.signProfileMetadata(
      unsignedPayload,
      latest.createdAt,
    );

    return ProfileMetadataResponseSchema.parse({
      ...unsignedPayload,
      signature: signature?.signature,
      signatureAlgorithm: signature?.signatureAlgorithm,
      signatureKeyId: signature?.signatureKeyId,
      signatureInput: signature?.signatureInput,
      signedAt: signature?.signedAt,
    });
  }

  private extractFancyMenu(value: unknown) {
    const parsed = FancyMenuSettingsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private normalizeLockUrl(lockUrl: string): string {
    try {
      const parsed = new URL(lockUrl);
      if (parsed.protocol === 'http:' && !this.isLoopback(parsed.hostname)) {
        parsed.protocol = 'https:';
      }
      return parsed.toString();
    } catch {
      return lockUrl;
    }
  }

  private isLoopback(hostname: string): boolean {
    return (
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    );
  }
}
