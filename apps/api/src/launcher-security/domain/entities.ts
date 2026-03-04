export type PairingClaimRecord = {
  id: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  issuedAt: Date;
  issuedBy: string | null;
  consumedByInstallationId: string | null;
  consumedByDeviceHash: string | null;
};

export type TrustedDeviceRecord = {
  id: string;
  installationId: string;
  publicKeyHash: string;
  publicKeyBase64: string;
  deviceFingerprintHash: string;
  appVersion: string | null;
  platform: string | null;
  lastSeenAt: Date | null;
  trustedAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
};

export type ChallengeRecord = {
  id: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type SessionRecord = {
  id: string;
  tokenHash: string;
  tokenId: string;
  installationId: string;
  publicKeyBase64: string;
  userAgentHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};
