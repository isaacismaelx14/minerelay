import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../db/prisma.service';
import { AdminErrorCode } from '../common/admin-error-catalog';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminInputParserService } from '../common/admin-input-parser.service';
import { AdminAuthService } from './admin-auth.service';

export const ACCESS_COOKIE = 'mvl_admin_access';
export const REFRESH_COOKIE = 'mvl_admin_refresh';
export const CSRF_COOKIE = 'mvl_admin_csrf';
export const ADMIN_REFRESH_HEADER = 'x-admin-refresh-token';

export interface AdminSessionResult {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class AdminSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminSessionService.name);
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly cookieSecure: boolean;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AdminAuthService,
    private readonly parser: AdminInputParserService,
    private readonly errors: AdminExceptionMapper,
  ) {
    const accessMinutes = Number(
      this.config.get('ADMIN_ACCESS_TOKEN_TTL_MINUTES') ?? 15,
    );
    const refreshDays = Number(
      this.config.get('ADMIN_REFRESH_TOKEN_TTL_DAYS') ?? 14,
    );
    this.accessTtlMs = Math.max(1, accessMinutes) * 60 * 1000;
    this.refreshTtlMs = Math.max(1, refreshDays) * 24 * 60 * 60 * 1000;
    const secureRaw = this.config.get<string>('ADMIN_COOKIE_SECURE');
    this.cookieSecure =
      secureRaw === 'true' || this.config.get('NODE_ENV') === 'production';
  }

  public hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public readCookie(request: Request, name: string): string | null {
    return this.parser.readCookie(request, name);
  }

  public readAuthorizationBearer(request: Request): string | null {
    return this.parser.readBearerAuthorization(request);
  }

  public readQueryParam(request: Request, name: string): string | null {
    const value = request.query[name];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === 'string') {
        const trimmed = first.trim();
        return trimmed || null;
      }
    }
    return null;
  }

  public readAccessToken(request: Request): string | null {
    return (
      this.readAuthorizationBearer(request) ??
      this.readCookie(request, ACCESS_COOKIE)
    );
  }

  public readRefreshToken(request: Request): string | null {
    const header = this.parser.readHeader(request, ADMIN_REFRESH_HEADER);
    if (header) {
      return header;
    }
    return this.readCookie(request, REFRESH_COOKIE);
  }

  public async getActiveSession(accessTokenHash: string) {
    return this.prisma.adminSession.findFirst({
      where: {
        accessTokenHash,
        revokedAt: null,
      },
    });
  }

  public async createSession(request: Request): Promise<AdminSessionResult> {
    const accessToken = this.authService.generateRandomToken(48);
    const refreshToken = this.authService.generateRandomToken(48);

    const accessHash = this.hashToken(accessToken);
    const refreshHash = this.hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + this.accessTtlMs);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const ip = request.ip ?? 'unknown';

    const session = await this.prisma.adminSession.create({
      data: {
        id: this.authService.generateRandomToken(16),
        accessTokenHash: accessHash,
        refreshTokenHash: refreshHash,
        expiresAt,
        refreshExpiresAt,
        ip,
        userAgent: request.headers['user-agent']?.slice(0, 256),
      },
    });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt,
    };
  }

  public async rotateSession(
    oldRefreshToken: string,
  ): Promise<AdminSessionResult> {
    const oldRefreshHash = this.hashToken(oldRefreshToken);

    const session = await this.prisma.adminSession.findFirst({
      where: { refreshTokenHash: oldRefreshHash },
    });

    if (!session || session.revokedAt) {
      throw this.errors.fromCode(AdminErrorCode.SESSION_INVALID);
    }

    if (session.refreshExpiresAt.getTime() <= Date.now()) {
      throw this.errors.fromCode(AdminErrorCode.SESSION_EXPIRED);
    }

    const newAccessToken = this.authService.generateRandomToken(48);
    const newRefreshToken = this.authService.generateRandomToken(48);

    const newAccessHash = this.hashToken(newAccessToken);
    const newRefreshHash = this.hashToken(newRefreshToken);

    const expiresAt = new Date(Date.now() + this.accessTtlMs);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    const updated = await this.prisma.adminSession.update({
      where: { id: session.id },
      data: {
        accessTokenHash: newAccessHash,
        refreshTokenHash: newRefreshHash,
        expiresAt,
        refreshExpiresAt,
      },
    });

    return {
      sessionId: updated.id,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      refreshExpiresAt,
    };
  }

  public async revokeSession(
    accessToken: string | null,
    refreshToken: string | null,
  ) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      const session = await this.prisma.adminSession.findFirst({
        where: { refreshTokenHash: hash },
      });
      if (session) {
        await this.prisma.adminSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
    } else if (accessToken) {
      const hash = this.hashToken(accessToken);
      const session = await this.prisma.adminSession.findFirst({
        where: { accessTokenHash: hash },
      });
      if (session) {
        await this.prisma.adminSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  public setSessionCookies(response: Response, session: AdminSessionResult) {
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    response.cookie(CSRF_COOKIE, this.authService.generateRandomToken(32), {
      httpOnly: false, // Critical: must be readable by frontend JS for double-submit
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: '/',
      expires: session.refreshExpiresAt,
    });

    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: '/',
      expires: session.refreshExpiresAt,
    });
  }

  public clearSessionCookies(response: Response) {
    const options = {
      path: '/',
      secure: this.cookieSecure,
      sameSite: 'strict' as const,
    };
    response.clearCookie(ACCESS_COOKIE, options);
    response.clearCookie(REFRESH_COOKIE, options);
    response.clearCookie(CSRF_COOKIE, options);
  }

  onModuleInit() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions().catch((error) => {
          this.logger.error('Failed to clean up sessions', error);
        });
      },
      60 * 60 * 1000,
    );
    // Run once at startup
    this.cleanupExpiredSessions().catch((error) => {
      this.logger.error('Failed to clean up sessions', error);
    });
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  public async cleanupExpiredSessions() {
    try {
      const result = await this.prisma.adminSession.deleteMany({
        where: {
          OR: [
            { refreshExpiresAt: { lt: new Date() } },
            { revokedAt: { not: null } },
          ],
        },
      });
      if (result.count > 0) {
        this.logger.log(
          `Cleaned up ${result.count} expired/revoked admin sessions`,
        );
      }
    } catch (e) {
      this.logger.error('Failed to clean up sessions', e);
    }
  }
}
