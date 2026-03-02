import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type AssetCacheEntry = {
  content: string;
  path: string;
  mtimeMs: number;
};

const assetCache = new Map<string, AssetCacheEntry>();

function resolveAssetPath(fileName: string): string {
  const candidates = [
    join(process.cwd(), 'apps/api/src/admin/public', fileName),
    join(__dirname, 'public', fileName),
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
  const path = resolveAssetPath(fileName);
  const stats = statSync(path);
  const cached = assetCache.get(fileName);
  if (
    cached &&
    cached.path === path &&
    Math.trunc(cached.mtimeMs) === Math.trunc(stats.mtimeMs)
  ) {
    return cached.content;
  }

  const content = readFileSync(path, 'utf8');
  assetCache.set(fileName, {
    content,
    path,
    mtimeMs: stats.mtimeMs,
  });
  return content;
}

export function readLoginScript(): string {
  return readAsset('login.app.js');
}

export function readAdminScript(): string {
  return readAsset('admin.app.js');
}
