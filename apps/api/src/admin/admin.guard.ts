import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminErrorCode } from './common/admin-error-catalog';
import { AdminExceptionMapper } from './common/admin-exception.mapper';
import { AdminSessionService } from './auth/admin-session.service';
import { ADMIN_PUBLIC_KEY } from './admin-auth.decorator';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: AdminSessionService,
    private readonly errors: AdminExceptionMapper,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      ADMIN_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const accessToken = this.sessionService.readAccessToken(request);
    if (!accessToken) {
      throw this.errors.fromCode(AdminErrorCode.AUTH_REQUIRED);
    }

    const tokenHash = this.sessionService.hashToken(accessToken);
    const session = await this.sessionService.getActiveSession(tokenHash);

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw this.errors.fromCode(AdminErrorCode.AUTH_REQUIRED);
    }

    return true;
  }
}
