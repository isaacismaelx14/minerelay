import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../db/prisma.service';
import { FancyMenuSettingsSchema, ProfileMetadataResponse, ProfileMetadataResponseSchema } from '@mvl/shared';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
      throw new NotFoundException(`No profile version found for server '${serverId}'`);
    }

    const allowedMinecraftVersions = Array.from(
      new Set([
        ...server.allowedMinecraftVersions,
        latest.minecraftVersion,
      ]),
    );
    const lockFancyMenu = this.extractFancyMenu(latest.lockJson);
    const serverFancyMenu = this.extractFancyMenu(server.fancyMenuSettings);
    const profileFancyMenu = this.extractFancyMenu(latest.fancyMenuSettings);
    const fancyMenu = profileFancyMenu ?? serverFancyMenu ?? lockFancyMenu ?? undefined;
    const fancyMenuEnabled = latest.fancyMenuEnabled || server.fancyMenuEnabled || fancyMenu?.enabled === true;

    return ProfileMetadataResponseSchema.parse({
      profileId: latest.profileId,
      version: latest.version,
      minecraftVersion: latest.minecraftVersion,
      loader: latest.loader,
      loaderVersion: latest.loaderVersion,
      lockUrl: latest.lockUrl,
      serverName: server.name,
      serverAddress: server.address,
      allowedMinecraftVersions,
      fancyMenuEnabled,
      fancyMenu,
      signature: latest.signature ?? undefined,
    });
  }

  private extractFancyMenu(value: unknown) {
    const parsed = FancyMenuSettingsSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
}
