import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type AppMetadata = {
  name: string;
  version: string;
};

let cachedMetadata: AppMetadata | null = null;

export function getApiMetadata(): AppMetadata {
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const packageJsonPath = resolvePackageJsonPath();
  const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    version?: string;
  };

  cachedMetadata = {
    name: parsed.name ?? '@minerelay/api',
    version: parsed.version ?? '0.0.0',
  };

  return cachedMetadata;
}

function resolvePackageJsonPath(): string {
  const candidates = [
    resolve(process.cwd(), 'apps/api/package.json'),
    resolve(__dirname, '..', 'package.json'),
    resolve(__dirname, '..', '..', 'package.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate apps/api/package.json');
}
