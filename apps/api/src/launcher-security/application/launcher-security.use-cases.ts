import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import nacl from 'tweetnacl';
import {
  createOpaqueToken,
  createPairingCode,
  isExpired,
} from '../domain/policies';
import type { LauncherSecurityRepositoryPort } from '../ports/launcher-security-repository.port';
import { LAUNCHER_SECURITY_REPOSITORY } from '../ports/launcher-security-repository.port';
import { Inject } from '@nestjs/common';

const AUTH_INPUT = 'launcher-auth-v1';
const REQUEST_INPUT = 'launcher-request-v1';

@Injectable()
export class LauncherSecurityUseCases implements OnModuleInit {
  private readonly logger = new Logger(LauncherSecurityUseCases.name);

  private readonly pairingV2Enabled: boolean;
  private readonly legacyInstallCodeHash: string | null;
  private readonly claimTtlMs: number;
  private readonly challengeTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly nonceTtlMs: number;
  private readonly requestSkewMs = 60_000;

  constructor(
    private readonly config: ConfigService,
    @Inject(LAUNCHER_SECURITY_REPOSITORY)
    private readonly repository: LauncherSecurityRepositoryPort,
  ) {
    this.pairingV2Enabled =
      (this.config.get<string>('LAUNCHER_PAIRING_V2_ENABLED') ?? 'false')
        .trim()
        .toLowerCase() === 'true';

    this.claimTtlMs =
      this.readPositiveInt('LAUNCHER_PAIRING_CLAIM_TTL_SECONDS', 600) * 1000;
    this.challengeTtlMs =
      this.readPositiveInt('LAUNCHER_CHALLENGE_TTL_SECONDS', 120) * 1000;
    this.sessionTtlMs =
      this.readPositiveInt('LAUNCHER_SESSION_TTL_SECONDS', 900) * 1000;
    this.nonceTtlMs =
      this.readPositiveInt('LAUNCHER_NONCE_TTL_SECONDS', 180) * 1000;

    const installCode =
      this.config.get<string>('LAUNCHER_INSTALL_CODE')?.trim() ?? '';
    this.legacyInstallCodeHash = installCode ? this.sha256(installCode) : null;
  }

  onModuleInit() {
    setInterval(() => {
      this.repository.cleanup(new Date()).catch((error: unknown) => {
        this.logger.warn(`launcher-security cleanup failed: ${String(error)}`);
      });
    }, 30_000).unref();
  }

  async issuePairingClaim(input: {
    issuedBy?: string;
    apiBaseUrl?: string;
  }): Promise<{
    claimId: string;
    pairingToken: string;
    pairingCode: string;
    deepLink: string;
    expiresAt: string;
  }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.claimTtlMs);
    const claimId = randomBytes(12).toString('hex');
    const pairingToken = createOpaqueToken(32);
    const pairingCode = createPairingCode(8);

    await this.repository.createPairingClaim({
      id: claimId,
      tokenHash: this.sha256(pairingToken),
      codeHash: this.sha256(pairingCode),
      expiresAt,
      issuedBy: input.issuedBy?.trim() || null,
    });

    const api = (input.apiBaseUrl ?? '').trim();
    const deepLinkApi = api ? `&api=${encodeURIComponent(api)}` : '';
    const deepLink = `minerelay://pair?token=${encodeURIComponent(pairingToken)}${deepLinkApi}`;

    this.audit('claim_issued', {
      claimId,
      issuedBy: input.issuedBy ?? null,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      claimId,
      pairingToken,
      pairingCode,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listPairingClaims(limit = 50) {
    const claims = await this.repository.listPairingClaims(limit);
    return claims.map((entry) => ({
      id: entry.id,
      expiresAt: entry.expiresAt.toISOString(),
      issuedAt: entry.issuedAt.toISOString(),
      issuedBy: entry.issuedBy,
      consumedAt: entry.consumedAt?.toISOString() ?? null,
      revokedAt: entry.revokedAt?.toISOString() ?? null,
      consumedByInstallationId: entry.consumedByInstallationId,
    }));
  }

  async revokePairingClaim(claimId: string): Promise<{ revoked: boolean }> {
    const revoked = await this.repository.revokePairingClaim(
      claimId,
      new Date(),
    );
    if (revoked) {
      this.audit('claim_revoked', { claimId });
    }
    return { revoked };
  }

  async resetTrust(): Promise<{ resetAt: string }> {
    const now = new Date();
    await this.repository.resetTrust(now);
    this.audit('trust_reset', { at: now.toISOString() });
    return { resetAt: now.toISOString() };
  }

  async createChallenge() {
    const now = Date.now();
    const id = createOpaqueToken(16);
    const nonce = createOpaqueToken(24);
    const expiresAt = new Date(now + this.challengeTtlMs);

    const challenge = await this.repository.createChallenge({
      id,
      nonce,
      expiresAt,
    });

    return {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt.toISOString(),
      expiresAt: challenge.expiresAt.toISOString(),
      signatureInput: AUTH_INPUT,
    };
  }

  async enrollInstallation(input: {
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
    const now = new Date();
    const { challenge, publicKeyBase64 } =
      await this.verifyChallengeSignature(input);

    const installationId = input.installationId.trim();
    const publicKeyHash = this.sha256(publicKeyBase64);
    const deviceFingerprintHash = this.sha256(
      this.normalizeFingerprint(input.deviceFingerprint),
    );
    const appVersion = this.normalizeOptional(input.appVersion);
    const platform = this.normalizeOptional(input.platform);

    const existing =
      await this.repository.findTrustedDeviceByInstallationId(installationId);

    if (existing && existing.revokedAt) {
      throw new UnauthorizedException('Launcher installation is revoked');
    }

    if (existing && existing.publicKeyHash === publicKeyHash) {
      await this.repository.markTrustedDeviceSeen(installationId, now);
      await this.repository.consumeChallenge(challenge.id, now);
      return { trusted: true, alreadyTrusted: true };
    }

    if (existing) {
      if (existing.deviceFingerprintHash !== deviceFingerprintHash) {
        await this.requirePairingClaim(
          input,
          installationId,
          deviceFingerprintHash,
          now,
        );
      }

      await this.repository.updateTrustedDevice({
        installationId,
        publicKeyHash,
        publicKeyBase64,
        deviceFingerprintHash,
        appVersion,
        platform,
        rotatedAt: now,
        lastSeenAt: now,
      });
      await this.repository.consumeChallenge(challenge.id, now);
      return { trusted: true, rotated: true };
    }

    await this.requirePairingClaim(
      input,
      installationId,
      deviceFingerprintHash,
      now,
    );

    await this.repository.createTrustedDevice({
      id: randomBytes(12).toString('hex'),
      installationId,
      publicKeyHash,
      publicKeyBase64,
      deviceFingerprintHash,
      appVersion,
      platform,
      trustedAt: now,
      lastSeenAt: now,
    });

    await this.repository.consumeChallenge(challenge.id, now);
    return { trusted: true, newlyTrusted: true };
  }

  async createSession(
    input: {
      challengeId: string;
      clientPublicKey: string;
      signature: string;
      installationId: string;
    },
    userAgent: string,
  ) {
    const now = new Date();
    const { challenge, publicKeyBase64 } =
      await this.verifyChallengeSignature(input);
    const publicKeyHash = this.sha256(publicKeyBase64);
    const installationId = input.installationId.trim();

    const trustedDevice =
      await this.repository.findTrustedDeviceByInstallationId(installationId);

    if (!trustedDevice || trustedDevice.revokedAt) {
      throw new UnauthorizedException(
        'Launcher installation is not trusted. Enroll this installation first.',
      );
    }

    if (trustedDevice.publicKeyHash !== publicKeyHash) {
      throw new UnauthorizedException(
        'Launcher key mismatch for this installation. Re-enroll this installation.',
      );
    }

    const normalizedUserAgent = userAgent.trim();
    if (!normalizedUserAgent) {
      throw new UnauthorizedException('Launcher user-agent is required');
    }

    await this.repository.consumeChallenge(challenge.id, now);
    await this.repository.markTrustedDeviceSeen(installationId, now);

    const token = createOpaqueToken(32);
    const tokenHash = this.sha256(token);
    const tokenId = createOpaqueToken(12);
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);

    await this.repository.createSession({
      id: randomBytes(12).toString('hex'),
      tokenHash,
      tokenId,
      installationId,
      publicKeyBase64,
      userAgentHash: this.sha256(normalizedUserAgent),
      expiresAt,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      tokenId,
      expiresAt: expiresAt.toISOString(),
      signatureInput: REQUEST_INPUT,
    };
  }

  async verifySignedRequest(input: {
    bearerToken: string;
    method: string;
    pathWithQuery: string;
    body: unknown;
    timestampMs: number;
    nonce: string;
    signatureBase64: string;
    userAgent: string;
  }) {
    const now = Date.now();
    const tokenHash = this.sha256(input.bearerToken);
    const session = await this.repository.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) {
      throw new UnauthorizedException('Launcher session expired or invalid');
    }

    const requestUserAgent = input.userAgent.trim();
    if (!requestUserAgent) {
      throw new UnauthorizedException('Launcher user-agent is required');
    }
    if (session.userAgentHash !== this.sha256(requestUserAgent)) {
      throw new UnauthorizedException('Launcher session user-agent mismatch');
    }

    if (Math.abs(now - input.timestampMs) > this.requestSkewMs) {
      throw new UnauthorizedException(
        'Launcher request timestamp out of range',
      );
    }

    const signatureBytes = this.base64ToBytes(
      input.signatureBase64,
      'signature',
    );
    if (signatureBytes.length !== 64) {
      throw new UnauthorizedException(
        'Launcher request signature must be 64 bytes',
      );
    }

    const publicKeyBytes = this.base64ToBytes(
      session.publicKeyBase64,
      'public key',
    );
    const canonicalBody = this.normalize(input.body ?? {});
    const message = this.stableStringify({
      signatureInput: REQUEST_INPUT,
      payload: {
        tokenId: session.tokenId,
        method: input.method.toUpperCase(),
        path: input.pathWithQuery,
        timestamp: input.timestampMs,
        nonce: input.nonce,
        body: canonicalBody,
      },
    });

    const valid = nacl.sign.detached.verify(
      Buffer.from(message, 'utf8'),
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      this.audit('invalid_signature', {
        tokenId: session.tokenId,
      });
      throw new UnauthorizedException('Invalid launcher request signature');
    }

    const nonceInserted = await this.repository.createNonce({
      id: randomBytes(12).toString('hex'),
      sessionId: session.id,
      nonce: input.nonce,
      expiresAt: new Date(now + this.nonceTtlMs),
    });

    if (!nonceInserted) {
      this.audit('nonce_replay', {
        tokenId: session.tokenId,
      });
      throw new UnauthorizedException('Launcher request nonce already used');
    }

    await this.repository.extendSession(
      session.id,
      new Date(now + this.sessionTtlMs),
    );

    return { tokenId: session.tokenId };
  }

  toNotFound() {
    throw new NotFoundException('Not Found');
  }

  private async requirePairingClaim(
    input: {
      pairingToken?: string;
      pairingCode?: string;
      installCode?: string;
    },
    installationId: string,
    deviceFingerprintHash: string,
    now: Date,
  ) {
    if (this.pairingV2Enabled) {
      const claim = await this.resolveClaim(input);
      if (
        !claim ||
        claim.revokedAt ||
        claim.consumedAt ||
        isExpired(claim.expiresAt, now)
      ) {
        this.audit('invalid_claim', { installationId });
        throw new UnauthorizedException('Invalid or expired pairing claim');
      }

      const consumed = await this.repository.consumeClaim({
        claimId: claim.id,
        consumedAt: now,
        installationId,
        deviceHash: deviceFingerprintHash,
      });

      if (!consumed) {
        this.audit('invalid_claim', { installationId });
        throw new UnauthorizedException(
          'Pairing claim has already been consumed',
        );
      }

      this.audit('claim_consumed', {
        claimId: claim.id,
        installationId,
      });
      return;
    }

    if (!this.legacyInstallCodeHash) {
      throw new UnauthorizedException(
        'Launcher install code is not configured on server',
      );
    }

    const installCode = input.installCode?.trim() ?? '';
    if (
      !installCode ||
      this.sha256(installCode) !== this.legacyInstallCodeHash
    ) {
      throw new UnauthorizedException('Invalid launcher install code');
    }
  }

  private async resolveClaim(input: {
    pairingToken?: string;
    pairingCode?: string;
  }) {
    const token = input.pairingToken?.trim() ?? '';
    if (token) {
      return this.repository.findClaimByTokenHash(this.sha256(token));
    }

    const code = input.pairingCode?.trim().toUpperCase() ?? '';
    if (code) {
      return this.repository.findClaimByCodeHash(this.sha256(code));
    }

    return null;
  }

  private async verifyChallengeSignature(input: {
    challengeId: string;
    clientPublicKey: string;
    signature: string;
  }) {
    const challenge = await this.repository.findChallengeById(
      input.challengeId,
    );
    const now = new Date();

    if (
      !challenge ||
      challenge.consumedAt ||
      isExpired(challenge.expiresAt, now)
    ) {
      throw new UnauthorizedException('Invalid or expired launcher challenge');
    }

    const publicKeyBytes = this.base64ToBytes(
      input.clientPublicKey,
      'public key',
    );
    if (publicKeyBytes.length !== 32) {
      throw new UnauthorizedException('Launcher public key must be 32 bytes');
    }

    const signatureBytes = this.base64ToBytes(input.signature, 'signature');
    if (signatureBytes.length !== 64) {
      throw new UnauthorizedException('Launcher signature must be 64 bytes');
    }

    const message = this.stableStringify({
      signatureInput: AUTH_INPUT,
      payload: {
        challengeId: challenge.id,
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt.toISOString(),
        expiresAt: challenge.expiresAt.toISOString(),
      },
    });

    const valid = nacl.sign.detached.verify(
      Buffer.from(message, 'utf8'),
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid launcher challenge signature');
    }

    return {
      challenge,
      publicKeyBase64: Buffer.from(publicKeyBytes).toString('base64'),
    };
  }

  private normalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalize(entry));
    }

    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>;
      const target: Record<string, unknown> = {};

      Object.keys(source)
        .sort()
        .forEach((key) => {
          const next = source[key];
          if (next !== undefined) {
            target[key] = this.normalize(next);
          }
        });

      return target;
    }

    return value;
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.normalize(value));
  }

  private base64ToBytes(value: string, label: string): Uint8Array {
    const trimmed = value.trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      throw new UnauthorizedException(`Invalid ${label} encoding`);
    }

    const decoded = Buffer.from(trimmed, 'base64');
    const normalized = decoded.toString('base64').replace(/=+$/g, '');
    const originalNormalized = trimmed.replace(/=+$/g, '');
    if (normalized !== originalNormalized) {
      throw new UnauthorizedException(`Invalid ${label} encoding`);
    }

    return new Uint8Array(decoded);
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeOptional(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeFingerprint(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new UnauthorizedException('deviceFingerprint is required');
    }
    return trimmed;
  }

  private readPositiveInt(envName: string, fallback: number): number {
    const raw = this.config.get<string>(envName)?.trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private audit(event: string, details: Record<string, unknown>) {
    this.logger.log(
      JSON.stringify({
        source: 'launcher-security',
        event,
        details,
      }),
    );
  }
}
