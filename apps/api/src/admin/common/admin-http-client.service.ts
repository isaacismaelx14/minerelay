import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminDomainError } from './admin-domain.error';
import { AdminErrorCode } from './admin-error-catalog';

const DEFAULT_USER_AGENT = 'mvl-admin-mvp/0.2.0';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

export type AdminHttpRequestOptions = {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: BodyInit | null;
  timeoutMs?: number;
  maxResponseBytes?: number;
  acceptedStatusCodes?: number[];
  upstreamName?: string;
};

@Injectable()
export class AdminHttpClientService {
  constructor(private readonly config: ConfigService) {}

  async requestJson<T>(
    url: string,
    options: AdminHttpRequestOptions = {},
  ): Promise<T> {
    const response = await this.request(url, options);
    this.assertStatus(response, options);
    const bytes = await this.readResponseBytes(response, options);
    try {
      return JSON.parse(bytes.toString('utf8')) as T;
    } catch (cause) {
      throw new AdminDomainError({
        code: AdminErrorCode.UPSTREAM_BAD_RESPONSE,
        details: {
          upstream: options.upstreamName ?? 'upstream',
          status: response.status,
          url,
        },
        cause,
      });
    }
  }

  async requestBytes(
    url: string,
    options: AdminHttpRequestOptions = {},
  ): Promise<Buffer> {
    const response = await this.request(url, options);
    this.assertStatus(response, options);
    return this.readResponseBytes(response, options);
  }

  async requestText(
    url: string,
    options: AdminHttpRequestOptions = {},
  ): Promise<string> {
    const bytes = await this.requestBytes(url, options);
    return bytes.toString('utf8');
  }

  async request(
    url: string,
    options: AdminHttpRequestOptions = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.resolveTimeoutMs(options);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = this.buildHeaders(options.headers);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ?? null,
        signal: controller.signal,
      });
      return response;
    } catch (cause) {
      const upstream = options.upstreamName ?? 'upstream';
      const code =
        cause &&
        typeof cause === 'object' &&
        'name' in cause &&
        (cause as { name?: string }).name === 'AbortError'
          ? AdminErrorCode.UPSTREAM_TIMEOUT
          : AdminErrorCode.UPSTREAM_UNAVAILABLE;
      throw new AdminDomainError({
        code,
        message:
          code === AdminErrorCode.UPSTREAM_TIMEOUT
            ? `Upstream service timed out (${upstream})`
            : `Upstream service is unavailable (${upstream})`,
        details: {
          upstream,
          url,
          timeoutMs,
        },
        cause,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(input?: Record<string, string | undefined>) {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json, text/plain, */*',
    };

    if (!input) {
      return headers;
    }

    for (const [key, value] of Object.entries(input)) {
      if (!value) {
        continue;
      }
      headers[key] = value;
    }

    return headers;
  }

  private assertStatus(response: Response, options: AdminHttpRequestOptions) {
    const accepted = options.acceptedStatusCodes;
    if (accepted && accepted.includes(response.status)) {
      return;
    }

    if (response.ok) {
      return;
    }

    const upstream = options.upstreamName ?? 'upstream';
    throw new AdminDomainError({
      code: AdminErrorCode.UPSTREAM_BAD_RESPONSE,
      message: `Upstream service returned an invalid response (${upstream}, status ${response.status})`,
      details: {
        upstream,
        status: response.status,
      },
    });
  }

  private async readResponseBytes(
    response: Response,
    options: AdminHttpRequestOptions,
  ): Promise<Buffer> {
    const maxBytes = this.resolveMaxBytes(options);
    if (!response.body) {
      return Buffer.alloc(0);
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AdminDomainError({
          code: AdminErrorCode.UPSTREAM_RESPONSE_TOO_LARGE,
          details: {
            upstream: options.upstreamName ?? 'upstream',
            maxBytes,
          },
        });
      }

      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks);
  }

  private resolveTimeoutMs(options: AdminHttpRequestOptions): number {
    if (Number.isFinite(options.timeoutMs) && options.timeoutMs! > 0) {
      return Math.trunc(options.timeoutMs!);
    }

    const configured = Number.parseInt(
      this.config.get<string>('ADMIN_HTTP_TIMEOUT_MS') || '',
      10,
    );
    if (Number.isFinite(configured) && configured >= 1000) {
      return configured;
    }

    return DEFAULT_TIMEOUT_MS;
  }

  private resolveMaxBytes(options: AdminHttpRequestOptions): number {
    if (
      Number.isFinite(options.maxResponseBytes) &&
      options.maxResponseBytes! > 0
    ) {
      return Math.trunc(options.maxResponseBytes!);
    }

    const configured = Number.parseInt(
      this.config.get<string>('ADMIN_HTTP_MAX_RESPONSE_BYTES') || '',
      10,
    );
    if (Number.isFinite(configured) && configured >= 1024) {
      return configured;
    }

    return DEFAULT_MAX_RESPONSE_BYTES;
  }
}
