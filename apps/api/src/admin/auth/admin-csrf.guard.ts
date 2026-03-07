import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AdminErrorCode } from '../common/admin-error-catalog';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminInputParserService } from '../common/admin-input-parser.service';
import { ADMIN_PUBLIC_KEY } from '../admin-auth.decorator';
import { CSRF_COOKIE } from './admin-session.service';

export const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class AdminCsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly parser: AdminInputParserService,
    private readonly errors: AdminExceptionMapper,
  ) {}

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

    if (this.parser.readBearerAuthorization(request)) {
      return true;
    }

    const csrfCookie = this.parser.readCookie(request, CSRF_COOKIE);
    const csrfHeader = this.parser.readHeader(request, CSRF_HEADER);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw this.errors.fromCode(AdminErrorCode.CSRF_INVALID);
    }

    return true;
  }
}
