import { Prisma } from '@prisma/client';

const PRISMA_CONNECTIVITY_ERROR_CODES = new Set(['P1001', 'P1002', 'P1017']);

export function isPrismaConnectivityError(
  error: unknown,
): error is
  | Prisma.PrismaClientInitializationError
  | Prisma.PrismaClientKnownRequestError {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    PRISMA_CONNECTIVITY_ERROR_CODES.has(error.code)
  );
}
