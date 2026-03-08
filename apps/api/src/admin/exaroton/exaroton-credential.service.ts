import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../db/prisma.service';
import { UpdateExarotonSettingsDto } from '../admin.dto';
import {
  AdminErrorCode,
  createAdminHttpException,
} from '../common/admin-error-catalog';
import {
  decryptExarotonApiKey,
  encryptExarotonApiKey,
} from '../crypto/exaroton-crypto';
import { ExarotonApiClient, ExarotonServer } from './exaroton-api.client';
import { ExarotonServerViewService } from './exaroton-server-view.service';
import {
  EXAROTON_INTEGRATION_ID,
  ExarotonBootstrapState,
  ExarotonMappedSettings,
  ExarotonSettingsState,
} from './exaroton.types';

type ExarotonConnectedState = {
  id: string;
  accountName: string | null;
  accountEmail: string | null;
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyAuthTag: string;
  selectedServerId: string | null;
  selectedServerName: string | null;
  selectedServerAddress: string | null;
  modsSyncEnabled: boolean;
  playerCanViewStatus: boolean;
  playerCanViewOnlinePlayers: boolean;
  playerCanModifyStatus: boolean;
  playerCanStartServer: boolean;
  playerCanStopServer: boolean;
  playerCanRestartServer: boolean;
};

@Injectable()
export class ExarotonCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly exarotonClient: ExarotonApiClient,
    private readonly view: ExarotonServerViewService,
  ) {}

  async connect(apiKey: string) {
    const encryptionKey = this.requireExarotonEncryptionKey();
    const cleanApiKey = apiKey.trim();
    if (!cleanApiKey) {
      throw createAdminHttpException(AdminErrorCode.EXAROTON_API_KEY_REQUIRED);
    }

    const [account, servers, existing] = await Promise.all([
      this.exarotonClient.getAccount(cleanApiKey),
      this.exarotonClient.listServers(cleanApiKey),
      this.prisma.exarotonIntegration.findUnique({
        where: { id: EXAROTON_INTEGRATION_ID },
      }),
    ]);

    if (existing && existing.apiKeyCiphertext) {
      throw createAdminHttpException(AdminErrorCode.EXAROTON_ALREADY_CONNECTED);
    }

    const encrypted = encryptExarotonApiKey(cleanApiKey, encryptionKey);
    const existingSettings = this.readSettings(existing);
    const selected = existing?.selectedServerId
      ? servers.find(
          (entry: ExarotonServer) => entry.id === existing.selectedServerId,
        ) || null
      : null;

    await this.prisma.exarotonIntegration.upsert({
      where: { id: EXAROTON_INTEGRATION_ID },
      create: {
        id: EXAROTON_INTEGRATION_ID,
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
        accountName: account.name,
        accountEmail: account.email,
        selectedServerId: selected?.id ?? null,
        selectedServerName: selected?.name ?? null,
        selectedServerAddress: selected?.address ?? null,
        modsSyncEnabled: existingSettings.modsSyncEnabled,
        playerCanViewStatus: existingSettings.playerCanViewStatus,
        playerCanViewOnlinePlayers: existingSettings.playerCanViewOnlinePlayers,
        playerCanModifyStatus: existingSettings.playerCanModifyStatus,
        playerCanStartServer: existingSettings.playerCanStartServer,
        playerCanStopServer: existingSettings.playerCanStopServer,
        playerCanRestartServer: existingSettings.playerCanRestartServer,
        connectedAt: new Date(),
      },
      update: {
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
        accountName: account.name,
        accountEmail: account.email,
        selectedServerId: selected?.id ?? null,
        selectedServerName: selected?.name ?? null,
        selectedServerAddress: selected?.address ?? null,
        modsSyncEnabled: existingSettings.modsSyncEnabled,
        playerCanViewStatus: existingSettings.playerCanViewStatus,
        playerCanViewOnlinePlayers: existingSettings.playerCanViewOnlinePlayers,
        playerCanModifyStatus: existingSettings.playerCanModifyStatus,
        playerCanStartServer: existingSettings.playerCanStartServer,
        playerCanStopServer: existingSettings.playerCanStopServer,
        playerCanRestartServer: existingSettings.playerCanRestartServer,
        connectedAt: new Date(),
      },
    });

    return {
      configured: true,
      connected: true,
      account,
      servers: servers.map((entry: ExarotonServer) =>
        this.view.mapServer(entry),
      ),
      selectedServer: selected ? this.view.mapServer(selected) : null,
      settings: this.mapSettings(existingSettings),
    };
  }

  async disconnect() {
    await this.prisma.exarotonIntegration.deleteMany({
      where: { id: EXAROTON_INTEGRATION_ID },
    });
    return { success: true };
  }

  async updateSettings(input: UpdateExarotonSettingsDto) {
    const integration = await this.prisma.exarotonIntegration.findUnique({
      where: { id: EXAROTON_INTEGRATION_ID },
    });
    if (!integration) {
      throw createAdminHttpException(AdminErrorCode.EXAROTON_NOT_CONNECTED);
    }

    const current = this.readSettings(integration);
    const legacyModifyToggle = input.playerCanModifyStatus;

    const nextPlayerCanStartServer =
      input.playerCanStartServer ??
      legacyModifyToggle ??
      current.playerCanStartServer;
    const nextPlayerCanStopServer =
      input.playerCanStopServer ??
      legacyModifyToggle ??
      current.playerCanStopServer;
    const nextPlayerCanRestartServer =
      input.playerCanRestartServer ??
      legacyModifyToggle ??
      current.playerCanRestartServer;

    const nextPlayerCanModifyStatus =
      nextPlayerCanStartServer ||
      nextPlayerCanStopServer ||
      nextPlayerCanRestartServer;

    const nextPlayerCanViewStatus = nextPlayerCanModifyStatus
      ? true
      : (input.playerCanViewStatus ?? current.playerCanViewStatus);
    const nextPlayerCanViewOnlinePlayers = nextPlayerCanViewStatus
      ? (input.playerCanViewOnlinePlayers ?? current.playerCanViewOnlinePlayers)
      : false;

    const updated = await this.prisma.exarotonIntegration.update({
      where: { id: EXAROTON_INTEGRATION_ID },
      data: {
        modsSyncEnabled: input.modsSyncEnabled ?? current.modsSyncEnabled,
        playerCanViewStatus: nextPlayerCanViewStatus,
        playerCanViewOnlinePlayers: nextPlayerCanViewOnlinePlayers,
        playerCanModifyStatus: nextPlayerCanModifyStatus,
        playerCanStartServer: nextPlayerCanStartServer,
        playerCanStopServer: nextPlayerCanStopServer,
        playerCanRestartServer: nextPlayerCanRestartServer,
      },
    });

    return {
      settings: this.mapSettings(this.readSettings(updated)),
    };
  }

  async getBootstrapState(): Promise<ExarotonBootstrapState> {
    const encryptionKey = this.getExarotonEncryptionKey();
    if (!encryptionKey) {
      return {
        configured: false,
        connected: false,
        account: null,
        selectedServer: null,
        settings: this.mapSettings({}),
        error:
          'EXAROTON_ENCRYPTION_KEY is not configured. Set it to enable this feature.',
      };
    }

    const integration = await this.prisma.exarotonIntegration.findUnique({
      where: { id: EXAROTON_INTEGRATION_ID },
    });

    if (!integration) {
      return {
        configured: true,
        connected: false,
        account: null,
        selectedServer: null,
        settings: this.mapSettings({}),
        error: null,
      };
    }

    const integrationSettings = this.readSettings(integration);
    let apiKey: string;
    try {
      apiKey = decryptExarotonApiKey(
        {
          ciphertext: integration.apiKeyCiphertext,
          iv: integration.apiKeyIv,
          authTag: integration.apiKeyAuthTag,
        },
        encryptionKey,
      );
    } catch {
      return {
        configured: true,
        connected: false,
        account: null,
        selectedServer: null,
        settings: this.mapSettings(integrationSettings),
        error: 'Stored Exaroton credentials could not be decrypted',
      };
    }

    const selectedServerId = integration.selectedServerId?.trim();
    let selectedServer = null;

    if (selectedServerId) {
      try {
        const live = await this.exarotonClient.getServer(
          apiKey,
          selectedServerId,
        );
        selectedServer = this.view.mapServer(live);
      } catch {
        selectedServer = {
          id: selectedServerId,
          name: integration.selectedServerName || selectedServerId,
          address: integration.selectedServerAddress || '',
          motd: '',
          status: 0,
          statusLabel: this.view.statusLabel(0),
          players: { max: 0, count: 0 },
          software: null,
          shared: false,
        };
      }
    }

    return {
      configured: true,
      connected: true,
      account: {
        name: integration.accountName || null,
        email: integration.accountEmail || null,
      },
      selectedServer,
      settings: this.mapSettings(integrationSettings),
      error: null,
    };
  }

  async requireConnection(): Promise<{
    apiKey: string;
    integration: ExarotonConnectedState;
  }> {
    const integration = await this.prisma.exarotonIntegration.findUnique({
      where: { id: EXAROTON_INTEGRATION_ID },
    });
    if (!integration) {
      throw createAdminHttpException(AdminErrorCode.EXAROTON_NOT_CONNECTED);
    }

    const encryptionKey = this.requireExarotonEncryptionKey();
    const apiKey = decryptExarotonApiKey(
      {
        ciphertext: integration.apiKeyCiphertext,
        iv: integration.apiKeyIv,
        authTag: integration.apiKeyAuthTag,
      },
      encryptionKey,
    );
    if (!apiKey) {
      throw createAdminHttpException(AdminErrorCode.EXAROTON_DECRYPT_FAILED);
    }

    const settings = this.readSettings(integration);
    return {
      apiKey,
      integration: {
        id: integration.id,
        accountName: integration.accountName,
        accountEmail: integration.accountEmail,
        apiKeyCiphertext: integration.apiKeyCiphertext,
        apiKeyIv: integration.apiKeyIv,
        apiKeyAuthTag: integration.apiKeyAuthTag,
        selectedServerId: integration.selectedServerId,
        selectedServerName: integration.selectedServerName,
        selectedServerAddress: integration.selectedServerAddress,
        modsSyncEnabled: settings.modsSyncEnabled,
        playerCanViewStatus: settings.playerCanViewStatus,
        playerCanViewOnlinePlayers: settings.playerCanViewOnlinePlayers,
        playerCanModifyStatus: settings.playerCanModifyStatus,
        playerCanStartServer: settings.playerCanStartServer,
        playerCanStopServer: settings.playerCanStopServer,
        playerCanRestartServer: settings.playerCanRestartServer,
      },
    };
  }

  readSettings(input: unknown): ExarotonSettingsState {
    const source = (input ?? {}) as {
      modsSyncEnabled?: unknown;
      playerCanViewStatus?: unknown;
      playerCanViewOnlinePlayers?: unknown;
      playerCanModifyStatus?: unknown;
      playerCanStartServer?: unknown;
      playerCanStopServer?: unknown;
      playerCanRestartServer?: unknown;
    };

    const playerCanStartServer = source.playerCanStartServer === true;
    const playerCanStopServer = source.playerCanStopServer === true;
    const playerCanRestartServer = source.playerCanRestartServer === true;
    const playerCanModifyStatus =
      source.playerCanModifyStatus === true ||
      playerCanStartServer ||
      playerCanStopServer ||
      playerCanRestartServer;
    const playerCanViewStatus =
      playerCanModifyStatus || source.playerCanViewStatus !== false;

    return {
      modsSyncEnabled: source.modsSyncEnabled !== false,
      playerCanViewStatus,
      playerCanViewOnlinePlayers:
        source.playerCanViewOnlinePlayers !== false && playerCanViewStatus,
      playerCanModifyStatus,
      playerCanStartServer,
      playerCanStopServer,
      playerCanRestartServer,
    };
  }

  mapSettings(input: {
    modsSyncEnabled?: boolean | null;
    playerCanViewStatus?: boolean | null;
    playerCanViewOnlinePlayers?: boolean | null;
    playerCanModifyStatus?: boolean | null;
    playerCanStartServer?: boolean | null;
    playerCanStopServer?: boolean | null;
    playerCanRestartServer?: boolean | null;
  }): ExarotonMappedSettings {
    const playerCanStartServer = input.playerCanStartServer === true;
    const playerCanStopServer = input.playerCanStopServer === true;
    const playerCanRestartServer = input.playerCanRestartServer === true;
    const playerCanModifyStatus =
      input.playerCanModifyStatus === true ||
      playerCanStartServer ||
      playerCanStopServer ||
      playerCanRestartServer;
    return {
      serverStatusEnabled: true,
      modsSyncEnabled: input.modsSyncEnabled ?? true,
      playerCanViewStatus:
        playerCanModifyStatus || input.playerCanViewStatus !== false,
      playerCanViewOnlinePlayers:
        input.playerCanViewOnlinePlayers !== false &&
        (playerCanModifyStatus || input.playerCanViewStatus !== false),
      playerCanStartServer,
      playerCanStopServer,
      playerCanRestartServer,
    };
  }

  private getExarotonEncryptionKey(): string | null {
    const value = this.config.get<string>('EXAROTON_ENCRYPTION_KEY')?.trim();
    return value && value.length > 0 ? value : null;
  }

  private requireExarotonEncryptionKey(): string {
    const encryptionKey = this.getExarotonEncryptionKey();
    if (!encryptionKey) {
      throw createAdminHttpException(
        AdminErrorCode.EXAROTON_ENCRYPTION_KEY_MISSING,
      );
    }
    return encryptionKey;
  }
}
