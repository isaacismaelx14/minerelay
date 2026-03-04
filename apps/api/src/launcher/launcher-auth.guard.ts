import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { LauncherService } from './launcher.service';
import { LAUNCHER_PUBLIC_KEY } from './launcher-auth.decorator';

const HEADER_TIMESTAMP = 'x-mvl-timestamp';
const HEADER_NONCE = 'x-mvl-nonce';
const HEADER_SIGNATURE = 'x-mvl-signature';

@Injectable()
export class LauncherAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly launcherService: LauncherService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      LAUNCHER_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const bearer = this.readBearerToken(request);

    const timestampRaw = request.header(HEADER_TIMESTAMP)?.trim() ?? '';
    const nonce = request.header(HEADER_NONCE)?.trim() ?? '';
    const signature = request.header(HEADER_SIGNATURE)?.trim() ?? '';

    if (!timestampRaw || !nonce || !signature) {
      throw new UnauthorizedException(
        'Missing launcher signed request headers',
      );
    }

    const timestampMs = Number(timestampRaw);
    if (!Number.isFinite(timestampMs)) {
      throw new UnauthorizedException('Invalid launcher request timestamp');
    }

    this.launcherService.verifySignedRequest({
      bearerToken: bearer,
      method: request.method,
      pathWithQuery: request.originalUrl || request.url,
      body: request.body ?? {},
      timestampMs,
      nonce,
      signatureBase64: signature,
      userAgent: request.get('user-agent') ?? '',
    });

    return true;
  }

  private readBearerToken(request: Request): string {
    const raw = request.header('authorization')?.trim() ?? '';
    if (!raw.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing launcher bearer token');
    }

    const token = raw.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing launcher bearer token');
    }

    return token;
  }
}
