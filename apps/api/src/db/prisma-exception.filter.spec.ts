import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { isPrismaConnectivityError } from './prisma-errors';

const createKnownRequestError = (
  code: string,
): Prisma.PrismaClientKnownRequestError => {
  const error = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype,
  ) as Prisma.PrismaClientKnownRequestError;

  Object.assign(error, {
    code,
    name: 'PrismaClientKnownRequestError',
    message: `Prisma error ${code}`,
    clientVersion: '6.19.2',
  });

  return error;
};

const createInitializationError =
  (): Prisma.PrismaClientInitializationError => {
    const error = Object.create(
      Prisma.PrismaClientInitializationError.prototype,
    ) as Prisma.PrismaClientInitializationError;

    Object.assign(error, {
      name: 'PrismaClientInitializationError',
      message: 'Prisma failed to initialize',
      clientVersion: '6.19.2',
    });

    return error;
  };

describe('PrismaExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects Prisma connectivity errors', () => {
    expect(isPrismaConnectivityError(createKnownRequestError('P1001'))).toBe(
      true,
    );
    expect(isPrismaConnectivityError(createKnownRequestError('P1017'))).toBe(
      true,
    );
    expect(isPrismaConnectivityError(createInitializationError())).toBe(true);
    expect(isPrismaConnectivityError(createKnownRequestError('P2002'))).toBe(
      false,
    );
  });

  it('returns 503 for Prisma connectivity failures', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/v1/admin/bootstrap',
        }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    const filter = new PrismaExceptionFilter({
      httpAdapter: {} as never,
    });

    filter.catch(createKnownRequestError('P1001'), host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Database temporarily unavailable',
      error: 'Service Unavailable',
    });
  });
});
