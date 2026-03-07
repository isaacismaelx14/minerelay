import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminExceptionMapper } from './admin-exception.mapper';

@Catch()
export class AdminExceptionFilter implements ExceptionFilter {
  constructor(private readonly mapper: AdminExceptionMapper) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const httpException = this.mapper.toHttpException(exception);
    const status = httpException.getStatus();
    const payload = httpException.getResponse();

    if (typeof payload === 'string') {
      response.status(status).json({
        code: status,
        message: payload,
        path: request.originalUrl || request.url,
      });
      return;
    }

    if (payload && typeof payload === 'object') {
      response.status(status).json(payload);
      return;
    }

    response.status(status).json({
      code: status,
      message: 'Unexpected error',
      path: request.originalUrl || request.url,
    });
  }
}
