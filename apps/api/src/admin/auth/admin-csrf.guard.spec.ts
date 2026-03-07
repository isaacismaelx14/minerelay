import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminInputParserService } from '../common/admin-input-parser.service';
import { AdminExceptionMapper } from '../common/admin-exception.mapper';
import { AdminCsrfGuard, CSRF_HEADER } from './admin-csrf.guard';
import { CSRF_COOKIE } from './admin-session.service';

function createContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

describe('AdminCsrfGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const parser = new AdminInputParserService();
  const errors = new AdminExceptionMapper();
  const guard = new AdminCsrfGuard(reflector, parser, errors);

  beforeEach(() => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(false);
  });

  it('allows GET without CSRF tokens', () => {
    const request = {
      method: 'GET',
      header: jest.fn().mockReturnValue(undefined),
      headers: {},
      query: {},
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('allows bearer-authenticated requests without CSRF token', () => {
    const request = {
      method: 'POST',
      header: jest
        .fn()
        .mockImplementation((name: string) =>
          name === 'authorization' ? 'Bearer token' : undefined,
        ),
      headers: {},
      query: {},
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('rejects token in query param without CSRF cookie/header match', () => {
    const request = {
      method: 'POST',
      header: jest.fn().mockReturnValue(undefined),
      headers: {
        cookie: '',
      },
      query: {
        accessToken: 'token-in-query',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when csrf cookie matches csrf header', () => {
    const token = 'csrf-token-value';
    const request = {
      method: 'POST',
      header: jest
        .fn()
        .mockImplementation((name: string) =>
          name === CSRF_HEADER ? token : undefined,
        ),
      headers: {
        cookie: `${CSRF_COOKIE}=${token}`,
      },
      query: {},
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });
});
