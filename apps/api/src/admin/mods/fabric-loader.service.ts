import { Injectable } from '@nestjs/common';
import { AdminHttpClientService } from '../common/admin-http-client.service';
import { FabricLoaderInfo } from './mods.types';

@Injectable()
export class FabricLoaderService {
  private readonly fabricMetaBase = 'https://meta.fabricmc.net';
  private readonly fabricCache = new Map<
    string,
    { expiresAt: number; value: FabricLoaderInfo[] }
  >();

  constructor(private readonly http: AdminHttpClientService) {}

  async getFabricVersions(minecraftVersion: string) {
    const version = minecraftVersion.trim();
    if (!version) {
      return { minecraftVersion: version, loaders: [], latestStable: null };
    }

    const cached = this.fabricCache.get(version);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        minecraftVersion: version,
        loaders: cached.value,
        latestStable:
          cached.value.find((loader) => loader.stable)?.version ?? null,
      };
    }

    const url = `${this.fabricMetaBase}/v2/versions/loader/${encodeURIComponent(version)}`;
    const payload = await this.http.requestJson<
      Array<{ loader?: { version?: string; stable?: boolean } }>
    >(url, {
      upstreamName: 'fabric-meta',
    });

    const loaders = payload
      .map((entry) => ({
        version: entry.loader?.version?.trim() ?? '',
        stable: entry.loader?.stable === true,
      }))
      .filter((entry) => entry.version.length > 0)
      .filter(
        (entry, idx, arr) =>
          arr.findIndex((item) => item.version === entry.version) === idx,
      );

    this.fabricCache.set(version, {
      value: loaders,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return {
      minecraftVersion: version,
      loaders,
      latestStable: loaders.find((loader) => loader.stable)?.version ?? null,
    };
  }
}
