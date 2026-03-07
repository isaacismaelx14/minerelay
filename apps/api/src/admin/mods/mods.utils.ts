import { inspect } from 'node:util';
import { AssetType, ModrinthSideSupport, ModrinthVersion } from './mods.types';

export function normalizeAssetType(type?: string): AssetType {
  if (type === 'resourcepack' || type === 'shaderpack') {
    return type;
  }
  return 'mod';
}

export function modrinthProjectTypeForAsset(type: AssetType): string {
  if (type === 'resourcepack') {
    return 'resourcepack';
  }
  if (type === 'shaderpack') {
    return 'shader';
  }
  return 'mod';
}

export function normalizeModrinthSideSupport(
  value: unknown,
): ModrinthSideSupport | undefined {
  if (value === 'required' || value === 'optional' || value === 'unsupported') {
    return value;
  }
  return undefined;
}

export function defaultInstallSideFromSupport(input: {
  clientSide?: ModrinthSideSupport;
  serverSide?: ModrinthSideSupport;
}): 'client' | 'server' | 'both' {
  const clientSide = input.clientSide ?? 'optional';
  const serverSide = input.serverSide ?? 'optional';

  if (clientSide === 'unsupported') {
    return 'server';
  }

  if (serverSide === 'unsupported') {
    return 'client';
  }

  if (clientSide === 'required' || serverSide === 'required') {
    return 'both';
  }

  return 'client';
}

export function versionTypeRank(
  value: ModrinthVersion['version_type'],
): number {
  switch (value) {
    case 'release':
      return 0;
    case 'beta':
      return 1;
    case 'alpha':
    default:
      return 2;
  }
}

export function parseModrinthIdsFromUrl(url: string): {
  projectId?: string;
  versionId?: string;
} {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'cdn.modrinth.com' && !host.endsWith('.cdn.modrinth.com')) {
      return {};
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'data') {
      return {};
    }

    const projectId = segments[1]?.trim() || undefined;
    const versionsIndex = segments.findIndex(
      (segment) => segment === 'versions',
    );
    const versionId =
      versionsIndex >= 0
        ? segments[versionsIndex + 1]?.trim() || undefined
        : undefined;

    return { projectId, versionId };
  } catch {
    return {};
  }
}

export function normalizeModrinthProvider(
  provider: unknown,
  projectId?: string,
): 'modrinth' | 'direct' {
  if (provider === 'modrinth' || provider === 'direct') {
    return provider;
  }
  return projectId ? 'modrinth' : 'direct';
}

export function formatErrorDetails(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (error instanceof Error) {
    const causeCode = (error as Error & { cause?: { code?: string } }).cause
      ?.code;
    if (typeof causeCode === 'string' && causeCode.trim().length > 0) {
      return `${error.message} [${causeCode}]`;
    }
    return error.message || error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return inspect(error);
  }
}
