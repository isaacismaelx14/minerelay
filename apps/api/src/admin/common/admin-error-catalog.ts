import { HttpException, HttpStatus } from '@nestjs/common';

export enum AdminErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  ADMIN_PASSWORD_NOT_INITIALIZED = 'ADMIN_PASSWORD_NOT_INITIALIZED',
  ADMIN_PASSWORD_INVALID = 'ADMIN_PASSWORD_INVALID',
  REFRESH_TOKEN_MISSING = 'REFRESH_TOKEN_MISSING',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CSRF_INVALID = 'CSRF_INVALID',
  EXAROTON_NOT_CONNECTED = 'EXAROTON_NOT_CONNECTED',
  EXAROTON_ALREADY_CONNECTED = 'EXAROTON_ALREADY_CONNECTED',
  EXAROTON_API_KEY_REQUIRED = 'EXAROTON_API_KEY_REQUIRED',
  EXAROTON_SERVER_ID_REQUIRED = 'EXAROTON_SERVER_ID_REQUIRED',
  EXAROTON_SERVER_NOT_SELECTED = 'EXAROTON_SERVER_NOT_SELECTED',
  EXAROTON_PLAYER_ACCESS_DISABLED = 'EXAROTON_PLAYER_ACCESS_DISABLED',
  EXAROTON_ACTION_FORBIDDEN = 'EXAROTON_ACTION_FORBIDDEN',
  EXAROTON_ENCRYPTION_KEY_MISSING = 'EXAROTON_ENCRYPTION_KEY_MISSING',
  EXAROTON_DECRYPT_FAILED = 'EXAROTON_DECRYPT_FAILED',
  PUBLISH_JOB_NOT_FOUND = 'PUBLISH_JOB_NOT_FOUND',
  PROFILE_VERSION_NOT_FOUND = 'PROFILE_VERSION_NOT_FOUND',
  FILE_REQUIRED = 'FILE_REQUIRED',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_URL = 'INVALID_URL',
  INVALID_PATH = 'INVALID_PATH',
  INVALID_API_BASE_URL = 'INVALID_API_BASE_URL',
  UPSTREAM_UNAVAILABLE = 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  UPSTREAM_BAD_RESPONSE = 'UPSTREAM_BAD_RESPONSE',
  UPSTREAM_RESPONSE_TOO_LARGE = 'UPSTREAM_RESPONSE_TOO_LARGE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export type AdminErrorCatalogEntry = {
  status: HttpStatus;
  message: string;
};

export const ADMIN_ERROR_CATALOG: Record<
  AdminErrorCode,
  AdminErrorCatalogEntry
> = {
  [AdminErrorCode.INVALID_INPUT]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid request input',
  },
  [AdminErrorCode.AUTH_REQUIRED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Admin authentication required',
  },
  [AdminErrorCode.ADMIN_PASSWORD_NOT_INITIALIZED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Admin password is not initialized',
  },
  [AdminErrorCode.ADMIN_PASSWORD_INVALID]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid admin password',
  },
  [AdminErrorCode.REFRESH_TOKEN_MISSING]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Missing refresh token',
  },
  [AdminErrorCode.SESSION_INVALID]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid or revoked session',
  },
  [AdminErrorCode.SESSION_EXPIRED]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Session expired',
  },
  [AdminErrorCode.CSRF_INVALID]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Invalid CSRF token',
  },
  [AdminErrorCode.EXAROTON_NOT_CONNECTED]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Exaroton account is not connected',
  },
  [AdminErrorCode.EXAROTON_ALREADY_CONNECTED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'An Exaroton account is already connected. Disconnect it first.',
  },
  [AdminErrorCode.EXAROTON_API_KEY_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Exaroton API key is required',
  },
  [AdminErrorCode.EXAROTON_SERVER_ID_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Exaroton server ID is required',
  },
  [AdminErrorCode.EXAROTON_SERVER_NOT_SELECTED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Select an Exaroton server first',
  },
  [AdminErrorCode.EXAROTON_PLAYER_ACCESS_DISABLED]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Player status access is disabled',
  },
  [AdminErrorCode.EXAROTON_ACTION_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Player action is not allowed',
  },
  [AdminErrorCode.EXAROTON_ENCRYPTION_KEY_MISSING]: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Exaroton integration is not configured: EXAROTON_ENCRYPTION_KEY is missing',
  },
  [AdminErrorCode.EXAROTON_DECRYPT_FAILED]: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Exaroton API key could not be decrypted',
  },
  [AdminErrorCode.PUBLISH_JOB_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'Publish job not found',
  },
  [AdminErrorCode.PROFILE_VERSION_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    message: 'No profile version found for the configured server',
  },
  [AdminErrorCode.FILE_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'No file uploaded',
  },
  [AdminErrorCode.FILE_TYPE_NOT_ALLOWED]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'File type is not allowed',
  },
  [AdminErrorCode.FILE_TOO_LARGE]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'File is too large',
  },
  [AdminErrorCode.INVALID_URL]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid URL',
  },
  [AdminErrorCode.INVALID_PATH]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid path',
  },
  [AdminErrorCode.INVALID_API_BASE_URL]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid apiBaseUrl',
  },
  [AdminErrorCode.UPSTREAM_UNAVAILABLE]: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Upstream service is unavailable',
  },
  [AdminErrorCode.UPSTREAM_TIMEOUT]: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Upstream service timed out',
  },
  [AdminErrorCode.UPSTREAM_BAD_RESPONSE]: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Upstream service returned an invalid response',
  },
  [AdminErrorCode.UPSTREAM_RESPONSE_TOO_LARGE]: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Upstream response exceeded allowed size',
  },
  [AdminErrorCode.INTERNAL_ERROR]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  },
};

export function createAdminHttpException(
  code: AdminErrorCode,
  message?: string,
): HttpException {
  const entry = ADMIN_ERROR_CATALOG[code];
  return new HttpException(
    {
      code,
      message: message ?? entry.message,
    },
    entry.status,
  );
}
