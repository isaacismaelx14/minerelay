import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const scrypt = promisify(scryptCb);
const prisma = new PrismaClient();
const ADMIN_CREDENTIAL_ID = 'global';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function main() {
  const nextPassword = process.env.ADMIN_NEW_PASSWORD?.trim();
  if (!nextPassword || nextPassword.length < 12) {
    throw new Error(
      'ADMIN_NEW_PASSWORD env var is required and must be at least 12 characters',
    );
  }

  const passwordHash = await hashPassword(nextPassword);
  await prisma.adminCredential.upsert({
    where: { id: ADMIN_CREDENTIAL_ID },
    create: {
      id: ADMIN_CREDENTIAL_ID,
      passwordHash,
      passwordCiphertext: '',
      passwordIv: '',
    },
    update: {
      passwordHash,
      passwordCiphertext: '',
      passwordIv: '',
    },
  });

  await prisma.adminSession.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log('Admin password rotated and active sessions revoked.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
