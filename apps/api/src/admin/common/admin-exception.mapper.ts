import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { inspect } from 'node:util';
import { ADMIN_ERROR_CATALOG, AdminErrorCode } from './admin-error-catalog';
import { AdminDomainError } from './admin-domain.error';

@Injectable()
export class AdminExceptionMapper {
  private readonly logger = new Logger(AdminExceptionMapper.name);

  toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (error instanceof AdminDomainError) {
      return this.fromDomainError(error);
    }

    this.logger.error(
      `Unhandled admin exception: ${this.formatUnknownError(error)}`,
      error instanceof Error ? error.stack : undefined,
    );

    const fallback = ADMIN_ERROR_CATALOG[AdminErrorCode.INTERNAL_ERROR];
    return new InternalServerErrorException({
      code: AdminErrorCode.INTERNAL_ERROR,
      message: fallback.message,
    });
  }

  fromCode(
    code: AdminErrorCode,
    input?: { message?: string; details?: unknown },
  ): HttpException {
    return this.fromDomainError(
      new AdminDomainError({
        code,
        message: input?.message,
        details: input?.details,
      }),
    );
  }

  fromDomainError(error: AdminDomainError): HttpException {
    const payload = {
      code: error.code,
      message: error.message,
    };

    if ((error.status as HttpStatus) === HttpStatus.BAD_REQUEST) {
      return new BadRequestException(payload);
    }
    if ((error.status as HttpStatus) === HttpStatus.UNAUTHORIZED) {
      return new UnauthorizedException(payload);
    }
    if ((error.status as HttpStatus) === HttpStatus.FORBIDDEN) {
      return new ForbiddenException(payload);
    }
    if ((error.status as HttpStatus) === HttpStatus.NOT_FOUND) {
      return new NotFoundException(payload);
    }
    if ((error.status as HttpStatus) === HttpStatus.BAD_GATEWAY) {
      return new BadGatewayException(payload);
    }

    return new HttpException(payload, error.status);
  }

  private formatUnknownError(error: unknown): string {
    if (!error) {
      return 'Unknown error';
    }
    if (error instanceof Error) {
      return error.message || error.name;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return inspect(error);
    }
  }
}
