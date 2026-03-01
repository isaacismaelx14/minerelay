import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../db/prisma.service';
import { AdminAuthService } from './admin-auth.service';

export const ACCESS_COOKIE = 'mvl_admin_access';
export const REFRESH_COOKIE = 'mvl_admin_refresh';
export const CSRF_COOKIE = 'mvl_admin_csrf';

export interface AdminSessionResult {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class AdminSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly cookieSecure: boolean;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AdminAuthService,
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
    if (!request.headers.cookie) {
      return null;
    }
    const match = request.headers.cookie.match(
      new RegExp(`(^| )${name}=([^;]+)`),
    );
    return match ? decodeURIComponent(match[2] || '') : null;
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
      throw new UnauthorizedException('Invalid or revoked session');
    }

    if (session.refreshExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
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
    const options = { path: '/', secure: this.cookieSecure, sameSite: 'strict' as const };
    response.clearCookie(ACCESS_COOKIE, options);
    response.clearCookie(REFRESH_COOKIE, options);
    response.clearCookie(CSRF_COOKIE, options);
  }

  onModuleInit() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions().catch(console.error);
      },
      60 * 60 * 1000,
    );
    // Run once at startup
    this.cleanupExpiredSessions().catch(console.error);
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
        console.log(
          `[AdminSessionService] Cleaned up ${result.count} expired/revoked sessions`,
        );
      }
    } catch (e) {
      console.error('[AdminSessionService] Failed to clean up sessions', e);
    }
  }
}
