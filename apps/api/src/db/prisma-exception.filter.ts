import {
  ArgumentsHost,
  Catch,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { isPrismaConnectivityError } from './prisma-errors';

@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(adapterHost: Pick<HttpAdapterHost, 'httpAdapter'>) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    if (!isPrismaConnectivityError(exception)) {
      return super.catch(exception, host);
    }

    const request = host.switchToHttp().getRequest<{
      method?: string;
      url?: string;
    }>();
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    const errorCode =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : 'initialization';

    this.logger.error(
      `Database unavailable while handling ${request.method ?? 'UNKNOWN'} ${
        request.url ?? 'UNKNOWN'
      } (${errorCode})`,
    );

    const serviceUnavailable = new ServiceUnavailableException(
      'Database temporarily unavailable',
    );

    response
      .status(serviceUnavailable.getStatus())
      .json(serviceUnavailable.getResponse());
  }
}
