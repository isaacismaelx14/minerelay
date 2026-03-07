import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class RequestOriginService {
  resolve(request: Request): string {
    const host = request.get('host') ?? 'localhost:3000';
    const forwardedProto = request
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
      ?.toLowerCase();
    const protocol =
      forwardedProto === 'https' || forwardedProto === 'http'
        ? forwardedProto
        : request.protocol;
    return `${protocol}://${host}`;
  }
}
