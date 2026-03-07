import { BadGatewayException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../db/prisma.service';
import { UpdateSettingsDto } from '../admin.dto';

const APP_SETTING_ID = 'global';
const SUPPORTED_MVP_PLATFORMS = new Set(['fabric']);

@Injectable()
export class AdminAppSettingsStoreService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureAppSettings(this.getServerId());
  }

  async ensureAppSettings(serverId = 'mvl') {
    const existing = await this.prisma.appSetting.findUnique({
      where: { id: APP_SETTING_ID },
    });

    if (existing) {
      return;
    }

    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    await this.prisma.appSetting.create({
      data: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: server?.allowedMinecraftVersions ?? [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
      },
    });
  }

  async getAppSettings() {
    const setting = await this.prisma.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
      },
      update: {},
    });

    return {
      supportedMinecraftVersions: setting.supportedMinecraftVersions,
      supportedPlatforms: setting.supportedPlatforms,
      releaseMajor: setting.releaseMajor,
      releaseMinor: setting.releaseMinor,
      releasePatch: setting.releasePatch,
      releaseVersion: this.formatSemver({
        major: setting.releaseMajor,
        minor: setting.releaseMinor,
        patch: setting.releasePatch,
      }),
      publishDraft: setting.publishDraft,
    };
  }

  async updateSettings(input: UpdateSettingsDto, serverId: string) {
    const cleanVersions = Array.from(
      new Set(
        input.supportedMinecraftVersions
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    const cleanPlatforms = Array.from(
      new Set(
        input.supportedPlatforms
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (
      !cleanPlatforms.every((platform) => SUPPORTED_MVP_PLATFORMS.has(platform))
    ) {
      throw new BadGatewayException(
        'Only fabric platform is supported for MVP',
      );
    }

    const [setting] = await this.prisma.$transaction([
      this.prisma.appSetting.upsert({
        where: { id: APP_SETTING_ID },
        create: {
          id: APP_SETTING_ID,
          supportedMinecraftVersions: cleanVersions,
          supportedPlatforms: cleanPlatforms,
        },
        update: {
          supportedMinecraftVersions: cleanVersions,
          supportedPlatforms: cleanPlatforms,
        },
      }),
      this.prisma.server.update({
        where: { id: serverId },
        data: {
          allowedMinecraftVersions: cleanVersions,
        },
      }),
    ]);

    return {
      supportedMinecraftVersions: setting.supportedMinecraftVersions,
      supportedPlatforms: setting.supportedPlatforms,
      releaseVersion: this.formatSemver({
        major: setting.releaseMajor,
        minor: setting.releaseMinor,
        patch: setting.releasePatch,
      }),
    };
  }

  async savePublishDraft(payload: Prisma.InputJsonValue) {
    return this.prisma.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
        publishDraft: payload,
      },
      update: {
        publishDraft: payload,
      },
    });
  }

  async discardPublishDraft() {
    await this.prisma.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: {
        id: APP_SETTING_ID,
        supportedMinecraftVersions: [],
        supportedPlatforms: ['fabric'],
        releaseMajor: 1,
        releaseMinor: 0,
        releasePatch: 0,
        publishDraft: Prisma.DbNull,
      },
      update: {
        publishDraft: Prisma.DbNull,
      },
    });

    return { success: true as const };
  }

  private formatSemver(parts: { major: number; minor: number; patch: number }) {
    return `${parts.major}.${parts.minor}.${parts.patch}`;
  }

  private getServerId() {
    return this.config.get<string>('SERVER_ID') ?? 'mvl';
  }
}
