import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nacl from 'tweetnacl';

const PROFILE_METADATA_INPUT = 'profile-metadata-v1';
const LOCK_INPUT = 'lock-v1';

export interface SignatureMetadata {
  signature: string;
  signatureAlgorithm: 'ed25519';
  signatureKeyId: string;
  signatureInput: string;
  signedAt: string;
}

@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private readonly isProd: boolean;
  private readonly keyId: string;
  private secretKey: Uint8Array | null = null;

  constructor(private readonly config: ConfigService) {
    this.isProd = this.config.get<string>('NODE_ENV') === 'production';
    this.keyId = this.config.get<string>('PROFILE_SIGNING_KEY_ID') ?? 'mvl-k1';
  }

  onModuleInit() {
    const raw = this.config.get<string>('PROFILE_SIGNING_SECRET_KEY_BASE64');
    if (!raw || !raw.trim()) {
      if (this.isProd) {
        throw new Error(
          'PROFILE_SIGNING_SECRET_KEY_BASE64 is required in production',
        );
      }

      this.logger.warn(
        'Signature key missing. Responses will be unsigned in development.',
      );
      return;
    }

    const keyBytes = Buffer.from(raw.trim(), 'base64');
    if (keyBytes.length === 64) {
      this.secretKey = new Uint8Array(keyBytes);
      return;
    }

    if (keyBytes.length === 32) {
      this.secretKey = nacl.sign.keyPair.fromSeed(new Uint8Array(keyBytes))
        .secretKey;
      return;
    }

    throw new Error(
      'PROFILE_SIGNING_SECRET_KEY_BASE64 must decode to 32-byte seed or 64-byte ed25519 secret key',
    );
  }

  signProfileMetadata(payload: unknown, signedAt?: Date): SignatureMetadata | null {
    return this.sign(PROFILE_METADATA_INPUT, payload, signedAt);
  }

  signLockPayload(payload: unknown, signedAt?: Date): SignatureMetadata | null {
    return this.sign(LOCK_INPUT, payload, signedAt);
  }

  private sign(
    signatureInput: string,
    payload: unknown,
    signedAt?: Date,
  ): SignatureMetadata | null {
    if (!this.secretKey) {
      return null;
    }

    const iso = (signedAt ?? new Date()).toISOString();
    const message = this.stableStringify({
      signatureInput,
      payload,
      signedAt: iso,
    });
    const signature = nacl.sign.detached(
      Buffer.from(message, 'utf8'),
      this.secretKey,
    );

    return {
      signature: Buffer.from(signature).toString('base64'),
      signatureAlgorithm: 'ed25519',
      signatureKeyId: this.keyId,
      signatureInput,
      signedAt: iso,
    };
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.normalize(value));
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
