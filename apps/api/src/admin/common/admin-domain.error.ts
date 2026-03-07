import { ADMIN_ERROR_CATALOG, AdminErrorCode } from './admin-error-catalog';

export class AdminDomainError extends Error {
  readonly name = 'AdminDomainError';
  readonly code: AdminErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(input: {
    code: AdminErrorCode;
    message?: string;
    status?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    const catalogEntry = ADMIN_ERROR_CATALOG[input.code];
    super(input.message ?? catalogEntry.message, {
      cause: input.cause,
    });
    this.code = input.code;
    this.status = input.status ?? catalogEntry.status;
    this.details = input.details;
  }
}
