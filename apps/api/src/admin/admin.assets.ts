import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const assetCache = new Map<string, string>();
const isProd = process.env.NODE_ENV === 'production';

function resolveAssetPath(fileName: string): string {
  const candidates = [
    join(__dirname, 'public', fileName),
    join(process.cwd(), 'apps/api/src/admin/public', fileName),
    join(process.cwd(), 'dist/src/admin/public', fileName),
    join(process.cwd(), 'dist/admin/public', fileName),
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Missing admin asset '${fileName}'`);
  }

  return found;
}

function readAsset(fileName: string): string {
  if (isProd) {
    const cached = assetCache.get(fileName);
    if (cached) {
      return cached;
    }
  }

  const content = readFileSync(resolveAssetPath(fileName), 'utf8');
  if (isProd) {
    assetCache.set(fileName, content);
  }
  return content;
}

export function readLoginScript(): string {
  return readAsset('login.app.js');
}

export function readAdminScript(): string {
  return readAsset('admin.app.js');
}
