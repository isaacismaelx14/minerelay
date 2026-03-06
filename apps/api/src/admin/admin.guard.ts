import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminSessionService } from './auth/admin-session.service';
import { ADMIN_PUBLIC_KEY } from './admin-auth.decorator';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: AdminSessionService,
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
      throw new UnauthorizedException('Admin authentication required');
    }

    const tokenHash = this.sessionService.hashToken(accessToken);
    const session = await this.sessionService.getActiveSession(tokenHash);

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Admin authentication required');
    }

    return true;
  }
}
