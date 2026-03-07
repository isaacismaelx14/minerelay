import type { Request } from 'express';
import { RequestOriginService } from './request-origin.service';

describe('RequestOriginService', () => {
  const service = new RequestOriginService();

  function buildRequest(input: {
    host?: string;
    protocol?: string;
    forwardedProto?: string;
  }): Request {
    return {
      protocol: input.protocol ?? 'http',
      get: (name: string) => {
        if (name === 'host') {
          return input.host;
        }
        if (name === 'x-forwarded-proto') {
          return input.forwardedProto;
        }
        return undefined;
      },
    } as Request;
  }

  it('uses x-forwarded-proto when provided', () => {
    const req = buildRequest({
      host: 'api.example.com',
      protocol: 'http',
      forwardedProto: 'https',
    });

    expect(service.resolve(req)).toBe('https://api.example.com');
  });

  it('falls back to request protocol and default host', () => {
    const req = buildRequest({ protocol: 'http' });

    expect(service.resolve(req)).toBe('http://localhost:3000');
  });
});
