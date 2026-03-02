import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SandboxPreviewModel = {
  titleText?: string;
  subtitleText?: string;
  playButtonLabel?: string;
  backgroundAssetId?: string;
  logoAssetId?: string;
  extraButtonLabels?: string[];
  notices?: string[];
};

export type SandboxPreviewResponse = {
  token: string;
  expiresAt: string;
  model: SandboxPreviewModel;
  assets: Array<{ id: string; contentType: string }>;
};

@Injectable()
export class BundleSandboxClient {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('FANCYMENU_SANDBOX_URL')?.trim() ||
      'http://localhost:3210'
    ).replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return (
      this.config.get<string>('FANCYMENU_SANDBOX_API_KEY')?.trim() ||
      'sandbox-dev-key'
    );
  }

  private get timeoutMs(): number {
    const raw = this.config.get<string>('FANCYMENU_SANDBOX_TIMEOUT_MS')?.trim();
    const value = raw ? Number.parseInt(raw, 10) : 10000;
    if (Number.isFinite(value) && value >= 1000) {
      return value;
    }
    return 10000;
  }

  private async requestJson<T>(
    path: string,
    method: 'POST' | 'GET',
    payload?: Buffer,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'x-api-key': this.apiKey,
          ...(payload ? { 'content-type': 'application/zip' } : {}),
        },
        body: payload ? new Uint8Array(payload) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new BadGatewayException(
          text || `Sandbox request failed (${response.status})`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(
        (error as Error)?.message || 'Sandbox request failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateBundle(payload: Buffer): Promise<{
    entryCount: number;
    totalUncompressedBytes: number;
  }> {
    return this.requestJson('/internal/fancymenu/validate', 'POST', payload);
  }

  async buildPreview(payload: Buffer): Promise<SandboxPreviewResponse> {
    return this.requestJson('/internal/fancymenu/preview', 'POST', payload);
  }

  async fetchPreviewAsset(
    token: string,
    assetId: string,
  ): Promise<{
    body: Buffer;
    contentType: string;
    cacheControl: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.baseUrl}/internal/fancymenu/preview/assets/${encodeURIComponent(token)}/${encodeURIComponent(assetId)}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': this.apiKey,
          },
          signal: controller.signal,
        },
      );

      if (response.status === 404) {
        throw new NotFoundException('Preview asset not found');
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new BadGatewayException(
          text || `Preview asset request failed (${response.status})`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        body: Buffer.from(arrayBuffer),
        contentType:
          response.headers.get('content-type') || 'application/octet-stream',
        cacheControl:
          response.headers.get('cache-control') || 'private, max-age=60',
      };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadGatewayException(
        (error as Error)?.message || 'Preview asset request failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
