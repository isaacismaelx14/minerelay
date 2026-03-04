import { randomBytes } from 'node:crypto';

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function createPairingCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let code = '';
  for (let index = 0; index < length; index += 1) {
    const value = bytes[index] ?? 0;
    code += alphabet[value % alphabet.length];
  }
  return code;
}

export function createOpaqueToken(size = 32): string {
  return randomBytes(size).toString('base64url');
}
