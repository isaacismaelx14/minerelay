import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AdminDomainError } from './admin-domain.error';
import { AdminErrorCode } from './admin-error-catalog';

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export type SemverParts = {
  major: number;
  minor: number;
  patch: number;
};

@Injectable()
export class AdminInputParserService {
  readCookie(request: Request, name: string): string | null {
    if (!request.headers.cookie) {
      return null;
    }
    const match = request.headers.cookie.match(
      new RegExp(`(^| )${name}=([^;]+)`),
    );
    return match ? decodeURIComponent(match[2] || '') : null;
  }

  readHeader(request: Request, name: string): string | null {
    const value = request.header(name);
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  readBearerAuthorization(request: Request): string | null {
    const raw = this.readHeader(request, 'authorization');
    if (!raw || !raw.startsWith('Bearer ')) {
      return null;
    }
    const token = raw.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  readQueryParam(request: Request, name: string): string | null {
    const value = request.query[name];
    if (typeof value === 'string') {
      const clean = value.trim();
      return clean.length > 0 ? clean : null;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      const clean = value[0].trim();
      return clean.length > 0 ? clean : null;
    }
    return null;
  }

  sanitizePathSegment(input: string, errorCode = AdminErrorCode.INVALID_PATH) {
    const value = input.trim();
    if (!value || !SAFE_PATH_SEGMENT.test(value)) {
      throw new AdminDomainError({ code: errorCode });
    }
    return value;
  }

  parseSemver(value: string): SemverParts | null {
    const clean = value.trim();
    const match = clean.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return null;
    }

    return {
      major: Number.parseInt(match[1] || '', 10),
      minor: Number.parseInt(match[2] || '', 10),
      patch: Number.parseInt(match[3] || '', 10),
    };
  }

  normalizeApiBaseUrl(raw?: string): string | undefined {
    if (!raw) {
      return undefined;
    }

    const value = raw.trim();
    if (!value) {
      return undefined;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new AdminDomainError({ code: AdminErrorCode.INVALID_API_BASE_URL });
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new AdminDomainError({ code: AdminErrorCode.INVALID_API_BASE_URL });
    }

    if (parsed.username || parsed.password || parsed.hash || parsed.search) {
      throw new AdminDomainError({ code: AdminErrorCode.INVALID_API_BASE_URL });
    }

    const hostname = parsed.hostname.toLowerCase();
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    if (protocol === 'http:' && !isLoopback) {
      throw new AdminDomainError({ code: AdminErrorCode.INVALID_API_BASE_URL });
    }

    return parsed.toString().replace(/\/+$/, '');
  }

  parseAbsoluteUrl(value: string): URL {
    try {
      return new URL(value);
    } catch {
      throw new AdminDomainError({ code: AdminErrorCode.INVALID_URL });
    }
  }
}
