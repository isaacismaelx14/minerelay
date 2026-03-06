import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ADMIN_ACCESS_QUERY, CSRF_COOKIE } from './admin-session.service';
import { ADMIN_PUBLIC_KEY } from '../admin-auth.decorator';

export const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class AdminCsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      ADMIN_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Only protect state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const authorization = request.header('authorization')?.trim();
    if (authorization?.startsWith('Bearer ')) {
      return true;
    }

    const accessTokenQuery = request.query[ADMIN_ACCESS_QUERY];
    if (
      (typeof accessTokenQuery === 'string' && accessTokenQuery.trim()) ||
      (Array.isArray(accessTokenQuery) &&
        typeof accessTokenQuery[0] === 'string' &&
        accessTokenQuery[0].trim())
    ) {
      return true;
    }

    const csrfCookie = this.readCookie(request, CSRF_COOKIE);
    const csrfHeader = request.header(CSRF_HEADER);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private readCookie(request: Request, name: string): string | null {
    if (!request.headers.cookie) {
      return null;
    }
    const match = request.headers.cookie.match(
      new RegExp(`(^| )${name}=([^;]+)`),
    );
    return match ? decodeURIComponent(match[2] || '') : null;
  }
}
