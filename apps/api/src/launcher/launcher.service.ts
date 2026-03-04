import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import nacl from 'tweetnacl';
import { AdminService } from '../admin/admin.service';

const AUTH_INPUT = 'launcher-auth-v1';
const REQUEST_INPUT = 'launcher-request-v1';
const TRUST_STORE_FILENAME = 'launcher-trust-store.json';

type LauncherChallenge = {
  id: string;
  nonce: string;
  issuedAt: string;
  expiresAt: number;
  consumed: boolean;
};

type LauncherSession = {
  tokenId: string;
  tokenHash: string;
  publicKey: Uint8Array;
  userAgentHash: string;
  expiresAt: number;
  nonceSeen: Map<string, number>;
};

type LauncherServerStatus = {
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

type LauncherStatusResponse = {
  selectedServer: LauncherServerStatus;
  permissions: {
    canViewStatus: boolean;
    canViewOnlinePlayers: boolean;
    canStartServer: boolean;
    canStopServer: boolean;
    canRestartServer: boolean;
  };
};

@Injectable()
export class LauncherService implements OnModuleInit {
  private readonly challenges = new Map<string, LauncherChallenge>();
  private readonly sessions = new Map<string, LauncherSession>();

  private readonly challengeTtlMs = 2 * 60 * 1000;
  private readonly sessionTtlMs = 15 * 60 * 1000;
  private readonly requestSkewMs = 60 * 1000;
  private readonly nonceTtlMs = 3 * 60 * 1000;
  private readonly trustedPublicKeyHashes = new Set<string>();
  private readonly trustStorePath: string;
  private readonly installCodeHash: string | null;

  constructor(
    private readonly adminService: AdminService,
    private readonly config: ConfigService,
  ) {
    const configuredPath =
      this.config.get<string>('LAUNCHER_TRUST_STORE_PATH')?.trim() ?? '';
    this.trustStorePath = configuredPath
      ? resolve(configuredPath)
      : resolve(process.cwd(), TRUST_STORE_FILENAME);

    const installCode =
      this.config.get<string>('LAUNCHER_INSTALL_CODE')?.trim() ?? '';
    this.installCodeHash = installCode ? this.sha256(installCode) : null;
  }

  onModuleInit() {
    this.loadTrustedKeys();
    setInterval(() => this.cleanup(), 30_000).unref();
  }

  createChallenge() {
    const now = Date.now();
    const id = randomBytes(16).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const issuedAt = new Date(now).toISOString();

    this.challenges.set(id, {
      id,
      nonce,
      issuedAt,
      expiresAt: now + this.challengeTtlMs,
      consumed: false,
    });

    return {
      challengeId: id,
      nonce,
      issuedAt,
      expiresAt: new Date(now + this.challengeTtlMs).toISOString(),
      signatureInput: AUTH_INPUT,
    };
  }

  createSession(
    input: {
      challengeId: string;
      clientPublicKey: string;
      signature: string;
    },
    userAgent: string,
  ) {
    const { challenge, publicKeyBytes, publicKeyBase64 } =
      this.verifyChallengeSignature(input);

    const publicKeyHash = this.sha256(publicKeyBase64);
    if (!this.trustedPublicKeyHashes.has(publicKeyHash)) {
      throw new UnauthorizedException(
        'Launcher installation is not trusted. Enroll this installation first.',
      );
    }

    challenge.consumed = true;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.sha256(token);
    const tokenId = randomBytes(12).toString('base64url');
    const expiresAt = Date.now() + this.sessionTtlMs;
    const normalizedUserAgent = userAgent.trim();
    if (!normalizedUserAgent) {
      throw new UnauthorizedException('Launcher user-agent is required');
    }

    this.sessions.set(tokenHash, {
      tokenId,
      tokenHash,
      publicKey: publicKeyBytes,
      userAgentHash: this.sha256(normalizedUserAgent),
      expiresAt,
      nonceSeen: new Map<string, number>(),
    });

    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      tokenId,
      expiresAt: new Date(expiresAt).toISOString(),
      signatureInput: REQUEST_INPUT,
    };
  }

  enrollInstallation(input: {
    challengeId: string;
    clientPublicKey: string;
    signature: string;
    installCode?: string;
  }) {
    const { challenge, publicKeyBase64 } = this.verifyChallengeSignature(input);
    const publicKeyHash = this.sha256(publicKeyBase64);

    if (this.trustedPublicKeyHashes.has(publicKeyHash)) {
      challenge.consumed = true;
      return { trusted: true, alreadyTrusted: true };
    }

    if (!this.installCodeHash) {
      if (this.trustedPublicKeyHashes.size === 0) {
        this.trustedPublicKeyHashes.add(publicKeyHash);
        this.persistTrustedKeys();
        challenge.consumed = true;
        return {
          trusted: true,
          bootstrapTrusted: true,
        };
      }

      throw new UnauthorizedException(
        'Launcher install code is not configured on server',
      );
    }

    const installCode = input.installCode?.trim() ?? '';
    if (!installCode || this.sha256(installCode) !== this.installCodeHash) {
      throw new UnauthorizedException('Invalid launcher install code');
    }

    this.trustedPublicKeyHashes.add(publicKeyHash);
    this.persistTrustedKeys();
    challenge.consumed = true;

    return { trusted: true, newlyTrusted: true };
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
    const tokenHash = this.sha256(input.bearerToken);
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Launcher session expired or invalid');
    }

    const requestUserAgent = input.userAgent.trim();
    if (!requestUserAgent) {
      throw new UnauthorizedException('Launcher user-agent is required');
    }
    if (session.userAgentHash !== this.sha256(requestUserAgent)) {
      throw new UnauthorizedException('Launcher session user-agent mismatch');
    }

    const now = Date.now();
    if (Math.abs(now - input.timestampMs) > this.requestSkewMs) {
      throw new UnauthorizedException(
        'Launcher request timestamp out of range',
      );
    }

    const existingNonceExpiry = session.nonceSeen.get(input.nonce);
    if (existingNonceExpiry && existingNonceExpiry > now) {
      throw new UnauthorizedException('Launcher request nonce already used');
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
      session.publicKey,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid launcher request signature');
    }

    session.nonceSeen.set(input.nonce, now + this.nonceTtlMs);
    session.expiresAt = now + this.sessionTtlMs;

    return { tokenId: session.tokenId };
  }

  getPlayerServerStatus(): Promise<LauncherStatusResponse> {
    const admin = this.adminService as unknown as {
      getLauncherPlayerServerStatus: () => Promise<LauncherStatusResponse>;
    };
    return admin.getLauncherPlayerServerStatus();
  }

  performPlayerServerAction(
    action: 'start' | 'stop' | 'restart',
  ): Promise<LauncherStatusResponse> {
    const admin = this.adminService as unknown as {
      runLauncherPlayerServerAction: (
        nextAction: 'start' | 'stop' | 'restart',
      ) => Promise<LauncherStatusResponse>;
    };
    return admin.runLauncherPlayerServerAction(action);
  }

  openPlayerServerStatusStream(handlers: {
    onStatus: (server: LauncherServerStatus) => void;
    onError: (message: string) => void;
  }): Promise<() => void> {
    const admin = this.adminService as unknown as {
      openLauncherPlayerStatusStream: (input: {
        onStatus: (server: LauncherServerStatus) => void;
        onError: (message: string) => void;
      }) => Promise<() => void>;
    };
    return admin.openLauncherPlayerStatusStream(handlers);
  }

  private cleanup() {
    const now = Date.now();

    for (const [key, challenge] of this.challenges.entries()) {
      if (challenge.expiresAt <= now || challenge.consumed) {
        this.challenges.delete(key);
      }
    }

    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(key);
        continue;
      }
      for (const [nonce, expiresAt] of session.nonceSeen.entries()) {
        if (expiresAt <= now) {
          session.nonceSeen.delete(nonce);
        }
      }
    }
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private bytesToBase64(value: Uint8Array): string {
    return Buffer.from(value).toString('base64');
  }

  private verifyChallengeSignature(input: {
    challengeId: string;
    clientPublicKey: string;
    signature: string;
  }) {
    const challenge = this.challenges.get(input.challengeId);
    if (!challenge || challenge.consumed || challenge.expiresAt <= Date.now()) {
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
        issuedAt: challenge.issuedAt,
        expiresAt: new Date(challenge.expiresAt).toISOString(),
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
      publicKeyBytes,
      publicKeyBase64: this.bytesToBase64(publicKeyBytes),
    };
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

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.normalize(value));
  }

  private loadTrustedKeys() {
    const configured =
      this.config.get<string>('LAUNCHER_TRUSTED_PUBLIC_KEYS')?.trim() ?? '';

    if (configured) {
      for (const raw of configured.split(',')) {
        const key = raw.trim();
        if (!key) {
          continue;
        }
        try {
          const bytes = this.base64ToBytes(key, 'public key');
          if (bytes.length !== 32) {
            continue;
          }
          this.trustedPublicKeyHashes.add(
            this.sha256(this.bytesToBase64(bytes)),
          );
        } catch {
          continue;
        }
      }
    }

    try {
      const raw = readFileSync(this.trustStorePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        trustedPublicKeyHashes?: unknown;
        trustedPublicKeys?: unknown;
      };
      const hashEntries = Array.isArray(parsed.trustedPublicKeyHashes)
        ? parsed.trustedPublicKeyHashes
        : [];
      for (const entry of hashEntries) {
        if (typeof entry === 'string' && entry.trim()) {
          this.trustedPublicKeyHashes.add(entry.trim());
        }
      }

      const entries = Array.isArray(parsed.trustedPublicKeys)
        ? parsed.trustedPublicKeys
        : [];

      for (const value of entries) {
        if (typeof value !== 'string') {
          continue;
        }
        try {
          const bytes = this.base64ToBytes(value, 'public key');
          if (bytes.length !== 32) {
            continue;
          }
          this.trustedPublicKeyHashes.add(
            this.sha256(this.bytesToBase64(bytes)),
          );
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  private persistTrustedKeys() {
    try {
      const dir = dirname(this.trustStorePath);
      mkdirSync(dir, { recursive: true });

      const payload = {
        trustedPublicKeyHashes: Array.from(
          this.trustedPublicKeyHashes.values(),
        ),
        updatedAt: new Date().toISOString(),
      };

      writeFileSync(this.trustStorePath, JSON.stringify(payload, null, 2), {
        encoding: 'utf8',
      });
    } catch {
      throw new UnauthorizedException('Failed to persist launcher trust store');
    }
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
}
