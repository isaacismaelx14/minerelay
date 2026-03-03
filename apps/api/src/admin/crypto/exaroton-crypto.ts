import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const KEY_SALT = 'mss-exaroton-encryption-v1';

export type EncryptedExarotonApiKey = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function deriveKey(secret: string): Buffer {
  const normalized = secret.trim();
  if (!normalized) {
    throw new Error('EXAROTON_ENCRYPTION_KEY is not configured');
  }

  return scryptSync(normalized, KEY_SALT, KEY_LENGTH_BYTES);
}

export function encryptExarotonApiKey(
  apiKey: string,
  secret: string,
): EncryptedExarotonApiKey {
  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey) {
    throw new Error('Exaroton API key is required');
  }

  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(cleanApiKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptExarotonApiKey(
  encrypted: EncryptedExarotonApiKey,
  secret: string,
): string {
  const key = deriveKey(secret);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8').trim();
}
