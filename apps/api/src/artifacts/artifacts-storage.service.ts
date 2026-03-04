import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, relative, resolve } from 'node:path';

type StoredArtifact = {
  body: Buffer;
  contentType: string;
};

@Injectable()
export class ArtifactsStorageService {
  private readonly s3Client: S3Client | null;
  private readonly s3Bucket: string | null;

  constructor(private readonly config: ConfigService) {
    const backend = this.storageBackend;
    if (backend !== 's3') {
      this.s3Client = null;
      this.s3Bucket = null;
      return;
    }

    const endpoint = this.requireConfig('ASSETS_S3_ENDPOINT');
    const bucket = this.requireConfig('ASSETS_S3_BUCKET');
    const accessKeyId = this.requireConfig('ASSETS_S3_ACCESS_KEY_ID');
    const secretAccessKey = this.requireConfig('ASSETS_S3_SECRET_ACCESS_KEY');
    const region =
      this.config.get<string>('ASSETS_S3_REGION')?.trim() || 'auto';
    const forcePathStyle =
      this.config.get<string>('ASSETS_S3_FORCE_PATH_STYLE')?.trim() !== 'false';

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.s3Bucket = bucket;
  }

  artifactUrlForKey(key: string, fallbackOrigin: string): string {
    const safeKey = this.normalizeKey(key);
    const encodedKey = safeKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    if (this.storageBackend === 's3') {
      const assetsBaseUrl = this.resolveAssetsPublicBaseUrl();
      if (assetsBaseUrl) {
        return `${assetsBaseUrl}/${encodedKey}`;
      }
    }

    return `${this.resolvePublicBaseUrl(fallbackOrigin)}/v1/artifacts/${encodedKey}`;
  }

  keyFromArtifactUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadGatewayException('Invalid artifact URL');
    }

    const assetsBaseUrl = this.resolveAssetsPublicBaseUrl();
    if (assetsBaseUrl) {
      let parsedBase: URL;
      try {
        parsedBase = new URL(assetsBaseUrl);
      } catch {
        throw new BadGatewayException('Invalid ASSETS_PUBLIC_BASE_URL');
      }

      const basePath = parsedBase.pathname.replace(/\/+$/, '');
      const sameOrigin =
        parsed.protocol === parsedBase.protocol && parsed.host === parsedBase.host;
      const matchesBasePath =
        parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);

      if (sameOrigin && matchesBasePath) {
        const encodedPath = parsed.pathname
          .slice(basePath.length)
          .replace(/^\/+/, '');
        if (!encodedPath) {
          throw new BadGatewayException('Invalid artifact URL path');
        }
        return this.decodeAndNormalizeKey(encodedPath);
      }
    }

    const marker = '/v1/artifacts/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) {
      throw new BadGatewayException(
        'Artifact URL must reference /v1/artifacts/',
      );
    }

    const encodedPath = parsed.pathname.slice(idx + marker.length);
    if (!encodedPath) {
      throw new BadGatewayException('Invalid artifact URL path');
    }

    return this.decodeAndNormalizeKey(encodedPath);
  }

  private decodeAndNormalizeKey(encodedPath: string): string {

    const decodedPath = encodedPath
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          throw new BadGatewayException('Invalid artifact URL encoding');
        }
      })
      .join('/');

    return this.normalizeKey(decodedPath);
  }

  async putArtifact(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const key = this.normalizeKey(params.key);
    if (this.storageBackend === 's3') {
      await this.putS3Artifact({ ...params, key });
      return;
    }

    const absolutePath = this.resolveLocalPath(key);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.body);
  }

  async getArtifact(key: string): Promise<StoredArtifact> {
    const safeKey = this.normalizeKey(key);
    if (this.storageBackend === 's3') {
      return this.getS3Artifact(safeKey);
    }

    const absolutePath = this.resolveLocalPath(safeKey);
    const body = await readFile(absolutePath).catch(() => null);
    if (!body) {
      throw new NotFoundException('Artifact not found');
    }

    return {
      body,
      contentType: this.contentTypeForKey(safeKey),
    };
  }

  private get storageBackend(): 'local' | 's3' {
    const explicit = this.config
      .get<string>('ASSETS_STORAGE_BACKEND')
      ?.trim()
      .toLowerCase();
    if (explicit === 's3') {
      return 's3';
    }
    if (explicit === 'local') {
      return 'local';
    }

    const hasS3Config =
      !!this.config.get<string>('ASSETS_S3_ENDPOINT')?.trim() &&
      !!this.config.get<string>('ASSETS_S3_BUCKET')?.trim() &&
      !!this.config.get<string>('ASSETS_S3_ACCESS_KEY_ID')?.trim() &&
      !!this.config.get<string>('ASSETS_S3_SECRET_ACCESS_KEY')?.trim();

    return hasS3Config ? 's3' : 'local';
  }

  private requireConfig(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new Error(`${name} is required when ASSETS_STORAGE_BACKEND=s3`);
    }
    return value;
  }

  private resolveArtifactsRoot(): string {
    const configured = this.config.get<string>('ARTIFACTS_DIR')?.trim();
    if (configured) {
      return resolve(configured);
    }

    return resolve(homedir(), '.mss-client', 'artifacts');
  }

  private resolveLocalPath(key: string): string {
    const root = this.resolveArtifactsRoot();
    const absolutePath = resolve(root, key);
    const rel = relative(root, absolutePath);
    if (rel.startsWith('..')) {
      throw new NotFoundException('Artifact not found');
    }
    return absolutePath;
  }

  private normalizeKey(rawKey: string): string {
    const normalized = rawKey
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join('/');

    if (!normalized) {
      throw new BadGatewayException('Invalid artifact key');
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '.' || segment === '..')) {
      throw new BadGatewayException('Invalid artifact key');
    }

    return normalized;
  }

  private resolvePublicBaseUrl(fallbackOrigin: string): string {
    const configured = this.config.get<string>('PUBLIC_BASE_URL')?.trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }
    return fallbackOrigin;
  }

  private resolveAssetsPublicBaseUrl(): string | null {
    const configured = this.config.get<string>('ASSETS_PUBLIC_BASE_URL')?.trim();
    if (!configured) {
      return null;
    }
    return configured.replace(/\/+$/, '');
  }

  private contentTypeForKey(key: string): string {
    const lower = extname(key).toLowerCase();
    if (lower === '.png') return 'image/png';
    if (lower === '.jpg' || lower === '.jpeg') return 'image/jpeg';
    if (lower === '.webp') return 'image/webp';
    if (lower === '.gif') return 'image/gif';
    if (lower === '.json') return 'application/json';
    if (lower === '.zip') return 'application/zip';
    if (lower === '.jar') return 'application/java-archive';
    return 'application/octet-stream';
  }

  private async putS3Artifact(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new BadGatewayException('S3 storage is not configured');
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType || this.contentTypeForKey(params.key),
        }),
      );
    } catch {
      throw new BadGatewayException(
        'Failed to upload artifact to object storage',
      );
    }
  }

  private async getS3Artifact(key: string): Promise<StoredArtifact> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new BadGatewayException('S3 storage is not configured');
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
        }),
      );
      const body = await response.Body?.transformToByteArray();
      if (!body || body.length === 0) {
        throw new NotFoundException('Artifact not found');
      }

      return {
        body: Buffer.from(body),
        contentType: response.ContentType || this.contentTypeForKey(key),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorCode = (error as { name?: string })?.name;
      if (errorCode === 'NoSuchKey' || errorCode === 'NotFound') {
        throw new NotFoundException('Artifact not found');
      }
      throw new BadGatewayException(
        'Failed to fetch artifact from object storage',
      );
    }
  }
}
