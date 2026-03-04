import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { LauncherSecurityUseCases } from '../launcher-security/application/launcher-security.use-cases';

@Injectable()
export class LauncherService {
  constructor(
    private readonly adminService: AdminService,
    private readonly security: LauncherSecurityUseCases,
  ) {}

  createChallenge() {
    return this.security.createChallenge();
  }

  createSession(
    input: {
      challengeId: string;
      clientPublicKey: string;
      signature: string;
      installationId: string;
    },
    userAgent: string,
  ) {
    return this.security.createSession(input, userAgent);
  }

  enrollInstallation(input: {
    challengeId: string;
    clientPublicKey: string;
    signature: string;
    installationId: string;
    pairingToken?: string;
    pairingCode?: string;
    deviceFingerprint: string;
    appVersion?: string;
    platform?: string;
    installCode?: string;
  }) {
    return this.security.enrollInstallation(input);
  }

  verifySignedRequest(input: {
    bearerToken: string;
    method: string;
    pathWithQuery: string;
    body: unknown;
    timestampMs: number;
    nonce: string;
    signatureBase64: string;
    userAgent: string;
  }) {
    return this.security.verifySignedRequest(input);
  }

  issuePairingClaim(input: { issuedBy?: string; apiBaseUrl?: string }) {
    return this.security.issuePairingClaim(input);
  }

  listPairingClaims(limit?: number) {
    return this.security.listPairingClaims(limit);
  }

  revokePairingClaim(claimId: string) {
    return this.security.revokePairingClaim(claimId);
  }

  resetTrust() {
    return this.security.resetTrust();
  }

  toNotFound() {
    this.security.toNotFound();
  }

  getPlayerServerStatus(): Promise<{
    selectedServer: {
      id: string;
      name: string;
      address: string;
      motd: string;
      status: number;
      statusLabel: string;
      players: { max: number; count: number };
      software: { id: string; name: string; version: string } | null;
      shared: boolean;
    };
    permissions: {
      canViewStatus: boolean;
      canViewOnlinePlayers: boolean;
      canStartServer: boolean;
      canStopServer: boolean;
      canRestartServer: boolean;
    };
  }> {
    const admin = this.adminService as unknown as {
      getLauncherPlayerServerStatus: () => Promise<{
        selectedServer: {
          id: string;
          name: string;
          address: string;
          motd: string;
          status: number;
          statusLabel: string;
          players: { max: number; count: number };
          software: { id: string; name: string; version: string } | null;
          shared: boolean;
        };
        permissions: {
          canViewStatus: boolean;
          canViewOnlinePlayers: boolean;
          canStartServer: boolean;
          canStopServer: boolean;
          canRestartServer: boolean;
        };
      }>;
    };
    return admin.getLauncherPlayerServerStatus();
  }

  performPlayerServerAction(
    action: 'start' | 'stop' | 'restart',
  ): Promise<{
    selectedServer: {
      id: string;
      name: string;
      address: string;
      motd: string;
      status: number;
      statusLabel: string;
      players: { max: number; count: number };
      software: { id: string; name: string; version: string } | null;
      shared: boolean;
    };
    permissions: {
      canViewStatus: boolean;
      canViewOnlinePlayers: boolean;
      canStartServer: boolean;
      canStopServer: boolean;
      canRestartServer: boolean;
    };
  }> {
    const admin = this.adminService as unknown as {
      runLauncherPlayerServerAction: (
        nextAction: 'start' | 'stop' | 'restart',
      ) => Promise<{
        selectedServer: {
          id: string;
          name: string;
          address: string;
          motd: string;
          status: number;
          statusLabel: string;
          players: { max: number; count: number };
          software: { id: string; name: string; version: string } | null;
          shared: boolean;
        };
        permissions: {
          canViewStatus: boolean;
          canViewOnlinePlayers: boolean;
          canStartServer: boolean;
          canStopServer: boolean;
          canRestartServer: boolean;
        };
      }>;
    };
    return admin.runLauncherPlayerServerAction(action);
  }

  openPlayerServerStatusStream(handlers: {
    onStatus: (server: {
      id: string;
      name: string;
      address: string;
      motd: string;
      status: number;
      statusLabel: string;
      players: { max: number; count: number };
      software: { id: string; name: string; version: string } | null;
      shared: boolean;
    }) => void;
    onError: (message: string) => void;
  }): Promise<() => void> {
    const admin = this.adminService as unknown as {
      openLauncherPlayerStatusStream: (input: {
        onStatus: (server: {
          id: string;
          name: string;
          address: string;
          motd: string;
          status: number;
          statusLabel: string;
          players: { max: number; count: number };
          software: { id: string; name: string; version: string } | null;
          shared: boolean;
        }) => void;
        onError: (message: string) => void;
      }) => Promise<() => void>;
    };
    return admin.openLauncherPlayerStatusStream(handlers);
  }
}
