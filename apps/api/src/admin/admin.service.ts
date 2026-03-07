import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ExarotonServerStatusDto,
  GenerateLockfileDto,
  InstallAssetDto,
  InstallModDto,
  PublishProfileResultDto,
  PublishProgressEventDto,
  PublishProfileDto,
  SaveDraftDto,
  UpdateExarotonSettingsDto,
  UpdateSettingsDto,
} from './admin.dto';
import { AdminAuthContextService } from './auth/admin-auth-context.service';
import { AdminExarotonContextService } from './exaroton/admin-exaroton-context.service';
import { AdminLauncherPairingContextService } from './launcher/admin-launcher-pairing-context.service';
import { AdminMediaContextService } from './media/admin-media-context.service';
import { AdminModsContextService } from './mods/admin-mods-context.service';
import { AdminPublishContextService } from './publish/admin-publish-context.service';
import { AdminSettingsContextService } from './settings/admin-settings-context.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly auth: AdminAuthContextService,
    private readonly settings: AdminSettingsContextService,
    private readonly exaroton: AdminExarotonContextService,
    private readonly launcherPairing: AdminLauncherPairingContextService,
    private readonly mods: AdminModsContextService,
    private readonly publish: AdminPublishContextService,
    private readonly media: AdminMediaContextService,
  ) {}

  login(password: string, request: Request, response: Response) {
    return this.auth.login(password, request, response);
  }

  refresh(request: Request, response: Response) {
    return this.auth.refresh(request, response);
  }

  logout(request: Request, response: Response) {
    return this.auth.logout(request, response);
  }

  authenticateRequest(request: Request): Promise<boolean> {
    return this.auth.authenticateRequest(request);
  }

  getBootstrap(includeLoaders = false) {
    return this.settings.getBootstrap(includeLoaders);
  }

  updateSettings(input: UpdateSettingsDto) {
    return this.settings.updateSettings(input);
  }

  saveDraft(input: SaveDraftDto) {
    return this.settings.saveDraft(input);
  }

  discardDraft() {
    return this.settings.discardDraft();
  }

  connectExaroton(apiKey: string) {
    return this.exaroton.connect(apiKey);
  }

  disconnectExaroton() {
    return this.exaroton.disconnect();
  }

  getExarotonStatus() {
    return this.exaroton.getStatus();
  }

  listExarotonServers() {
    return this.exaroton.listServers();
  }

  selectExarotonServer(serverId: string) {
    return this.exaroton.selectServer(serverId);
  }

  exarotonServerAction(action: 'start' | 'stop' | 'restart') {
    return this.exaroton.serverAction(action);
  }

  updateExarotonSettings(input: UpdateExarotonSettingsDto) {
    return this.exaroton.updateSettings(input);
  }

  createLauncherPairingClaim(apiBaseUrl?: string) {
    return this.launcherPairing.createPairingClaim(apiBaseUrl);
  }

  listLauncherPairingClaims() {
    return this.launcherPairing.listPairingClaims();
  }

  revokeLauncherPairingClaim(claimId: string) {
    return this.launcherPairing.revokePairingClaim(claimId);
  }

  resetLauncherTrust() {
    return this.launcherPairing.resetTrust();
  }

  syncExarotonModsNow() {
    return this.exaroton.syncModsNow();
  }

  openExarotonStatusStream(handlers: {
    onStatus: (server: ExarotonServerStatusDto) => void;
    onError: (message: string) => void;
  }) {
    return this.exaroton.openStatusStream(handlers);
  }

  getLauncherPlayerServerStatus() {
    return this.exaroton.getLauncherPlayerServerStatus();
  }

  runLauncherPlayerServerAction(action: 'start' | 'stop' | 'restart') {
    return this.exaroton.runLauncherPlayerServerAction(action);
  }

  openLauncherPlayerStatusStream(handlers: {
    onStatus: (server: ExarotonServerStatusDto) => void;
    onError: (message: string) => void;
  }) {
    return this.exaroton.openLauncherPlayerStatusStream(handlers);
  }

  getFabricVersions(minecraftVersion: string) {
    return this.mods.getFabricVersions(minecraftVersion);
  }

  searchMods(query: string, minecraftVersion: string) {
    return this.mods.searchMods(query, minecraftVersion);
  }

  searchAssets(
    query: string,
    minecraftVersion: string,
    type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    limit = 12,
  ) {
    return this.mods.searchAssets(query, minecraftVersion, type, limit);
  }

  popularAssets(
    minecraftVersion: string,
    type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    limit = 10,
  ) {
    return this.mods.popularAssets(minecraftVersion, type, limit);
  }

  analyzeModDependencies(projectId: string, minecraftVersion: string) {
    return this.mods.analyzeModDependencies(projectId, minecraftVersion);
  }

  analyzeModDependenciesBatch(projectIds: string[], minecraftVersion: string) {
    return this.mods.analyzeModDependenciesBatch(projectIds, minecraftVersion);
  }

  installMod(input: InstallModDto) {
    return this.mods.installMod(input);
  }

  installAsset(input: InstallAssetDto) {
    return this.mods.installAsset(input);
  }

  resolveCompatibleMod(
    projectId: string,
    minecraftVersion: string,
    versionId?: string,
  ) {
    return this.mods.resolveCompatibleMod(
      projectId,
      minecraftVersion,
      versionId,
    );
  }

  resolveCompatibleAsset(
    projectId: string,
    minecraftVersion: string,
    type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
    versionId?: string,
  ) {
    return this.mods.resolveCompatibleAsset(
      projectId,
      minecraftVersion,
      type,
      versionId,
    );
  }

  getModVersions(projectId: string, minecraftVersion: string) {
    return this.mods.getModVersions(projectId, minecraftVersion);
  }

  getAssetVersions(
    projectId: string,
    minecraftVersion: string,
    type: 'mod' | 'resourcepack' | 'shaderpack' = 'mod',
  ) {
    return this.mods.getAssetVersions(projectId, minecraftVersion, type);
  }

  generateLockfile(input: GenerateLockfileDto) {
    return this.publish.generateLockfile(input);
  }

  startPublishProfile(input: PublishProfileDto, requestOrigin: string) {
    return this.publish.startPublishProfile(input, requestOrigin);
  }

  openPublishStream(
    jobId: string,
    handlers: {
      onProgress: (event: PublishProgressEventDto) => void;
      onDone: (result: PublishProfileResultDto) => void;
      onError: (message: string) => void;
    },
  ) {
    return this.publish.openPublishStream(jobId, handlers);
  }

  publishProfile(
    input: PublishProfileDto,
    requestOrigin: string,
    options?: {
      onProgress?: (event: PublishProgressEventDto) => void;
    },
  ) {
    return this.publish.publishProfile(input, requestOrigin, options);
  }

  uploadMedia(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    requestOrigin: string,
  ) {
    return this.media.uploadMedia(file, requestOrigin);
  }

  uploadFancyMenuBundle(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    requestOrigin: string,
  ) {
    return this.media.uploadFancyMenuBundle(file, requestOrigin);
  }
}
