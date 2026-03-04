import type {
  ChallengeRecord,
  PairingClaimRecord,
  SessionRecord,
  TrustedDeviceRecord,
} from '../domain/entities';

export const LAUNCHER_SECURITY_REPOSITORY = Symbol(
  'LAUNCHER_SECURITY_REPOSITORY',
);

export interface LauncherSecurityRepositoryPort {
  createPairingClaim(input: {
    id: string;
    tokenHash: string;
    codeHash: string;
    expiresAt: Date;
    issuedBy: string | null;
  }): Promise<PairingClaimRecord>;
  listPairingClaims(limit: number): Promise<PairingClaimRecord[]>;
  revokePairingClaim(id: string, now: Date): Promise<boolean>;
  findClaimByTokenHash(tokenHash: string): Promise<PairingClaimRecord | null>;
  findClaimByCodeHash(codeHash: string): Promise<PairingClaimRecord | null>;
  consumeClaim(input: {
    claimId: string;
    consumedAt: Date;
    installationId: string;
    deviceHash: string;
  }): Promise<boolean>;

  createChallenge(input: {
    id: string;
    nonce: string;
    expiresAt: Date;
  }): Promise<ChallengeRecord>;
  findChallengeById(id: string): Promise<ChallengeRecord | null>;
  consumeChallenge(id: string, consumedAt: Date): Promise<boolean>;

  findTrustedDeviceByInstallationId(
    installationId: string,
  ): Promise<TrustedDeviceRecord | null>;
  createTrustedDevice(input: {
    id: string;
    installationId: string;
    publicKeyHash: string;
    publicKeyBase64: string;
    deviceFingerprintHash: string;
    appVersion: string | null;
    platform: string | null;
    trustedAt: Date;
    lastSeenAt: Date;
  }): Promise<void>;
  updateTrustedDevice(input: {
    installationId: string;
    publicKeyHash: string;
    publicKeyBase64: string;
    deviceFingerprintHash: string;
    appVersion: string | null;
    platform: string | null;
    rotatedAt: Date | null;
    lastSeenAt: Date;
  }): Promise<void>;
  markTrustedDeviceSeen(installationId: string, at: Date): Promise<void>;

  createSession(input: {
    id: string;
    tokenHash: string;
    tokenId: string;
    installationId: string;
    publicKeyBase64: string;
    userAgentHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  extendSession(sessionId: string, expiresAt: Date): Promise<void>;
  createNonce(input: {
    id: string;
    sessionId: string;
    nonce: string;
    expiresAt: Date;
  }): Promise<boolean>;

  resetTrust(now: Date): Promise<void>;
  cleanup(now: Date): Promise<void>;
}
