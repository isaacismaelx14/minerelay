import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ProfileLockSchema } from '@minerelay/shared';
import {
  runBootstrapSeed,
  shouldOverwriteExistingSeedData,
  type SeedPrisma,
} from '../src/db/bootstrap-seed';

const prisma = new PrismaClient();

async function main() {
  const root = resolve(__dirname, '../../../');
  const lockPath = resolve(root, 'infra/sample-data/profile.lock.json');
  const lockRaw: unknown = JSON.parse(readFileSync(lockPath, 'utf-8'));
  const lock = ProfileLockSchema.parse(lockRaw);

  const serverId = process.env.SERVER_ID ?? 'mvl';
  const profileId = lock.profileId;
  const configuredBaseUrl = process.env.API_BASE_URL?.trim();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const defaultBaseUrl = railwayDomain
    ? `https://${railwayDomain}`
    : 'http://localhost:3000';
  const baseUrl = (
    configuredBaseUrl && configuredBaseUrl.length > 0
      ? configuredBaseUrl
      : defaultBaseUrl
  ).replace(/\/+$/, '');
  const derivedLockUrl = `${baseUrl}/v1/locks/${profileId}/${lock.version}`;
  const lockUrl = process.env.LOCK_URL?.trim() || derivedLockUrl;

  await runBootstrapSeed({
    prisma: prisma as unknown as SeedPrisma,
    serverId,
    lock,
    lockUrl,
    overwriteExisting: shouldOverwriteExistingSeedData(process.env),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
