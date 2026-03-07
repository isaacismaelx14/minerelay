import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { AdminErrorCode } from '../common/admin-error-catalog';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminSessionService,
  type AdminSessionResult,
} from './admin-session.service';

const ADMIN_CREDENTIAL_ID = 'global';

function toAdminAuthPayload(session: AdminSessionResult) {
  return {
    success: true as const,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt.toISOString(),
    refreshExpiresAt: session.refreshExpiresAt.toISOString(),
  };
}

@Injectable()
export class AdminAuthContextService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AdminAuthService,
    private readonly sessionService: AdminSessionService,
    private readonly errors: AdminExceptionMapper,
  ) {}

  async onModuleInit() {
    await this.ensureAdminCredential();
  }

  async login(password: string, request: Request, response: Response) {
    const credential = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!credential) {
      throw this.errors.fromCode(AdminErrorCode.ADMIN_PASSWORD_NOT_INITIALIZED);
    }

    const valid = await this.authService.verifyPassword(
      password,
      credential.passwordHash,
    );
    if (!valid) {
      throw this.errors.fromCode(AdminErrorCode.ADMIN_PASSWORD_INVALID);
    }

    const session = await this.sessionService.createSession(request);
    this.sessionService.setSessionCookies(response, session);

    return toAdminAuthPayload(session);
  }

  async refresh(request: Request, response: Response) {
    const refreshToken = this.sessionService.readRefreshToken(request);
    if (!refreshToken) {
      throw this.errors.fromCode(AdminErrorCode.REFRESH_TOKEN_MISSING);
    }

    const refreshed = await this.sessionService.rotateSession(refreshToken);
    this.sessionService.setSessionCookies(response, refreshed);
    return toAdminAuthPayload(refreshed);
  }

  async logout(request: Request, response: Response) {
    const accessToken = this.sessionService.readAccessToken(request);
    const refreshToken = this.sessionService.readRefreshToken(request);

    await this.sessionService.revokeSession(accessToken, refreshToken);
    this.sessionService.clearSessionCookies(response);
    return { success: true };
  }

  authenticateRequest(request: Request): Promise<boolean> {
    return this.authenticate(request);
  }

  private async authenticate(request: Request): Promise<boolean> {
    const accessToken = this.sessionService.readAccessToken(request);
    if (!accessToken) {
      return false;
    }

    const tokenHash = this.sessionService.hashToken(accessToken);
    const session = await this.sessionService.getActiveSession(tokenHash);

    if (!session) {
      return false;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return false;
    }

    return true;
  }

  private async ensureAdminCredential(): Promise<void> {
    const existing = await this.prisma.adminCredential.findUnique({
      where: { id: ADMIN_CREDENTIAL_ID },
    });

    if (!existing) {
      const initialPassword = this.config.get<string>('ADMIN_INITIAL_PASSWORD');
      if (!initialPassword && this.config.get('NODE_ENV') === 'production') {
        throw new Error(
          'ADMIN_INITIAL_PASSWORD env var is required in production',
        );
      }

      const password =
        initialPassword || this.authService.generateRandomToken(24);
      const passwordHash = await this.authService.hashPassword(password);
      await this.prisma.adminCredential.create({
        data: {
          id: ADMIN_CREDENTIAL_ID,
          passwordHash,
          passwordCiphertext: '',
          passwordIv: '',
        },
      });

      if (!initialPassword) {
        this.logger.warn(`Auto-generated admin password for dev: ${password}`);
      }
    }
  }
}
