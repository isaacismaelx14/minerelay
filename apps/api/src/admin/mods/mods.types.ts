import { ManagedMod } from '../core-mod-policy.service';

export type ModrinthSideSupport = 'required' | 'optional' | 'unsupported';

export type AssetType = 'mod' | 'resourcepack' | 'shaderpack';

export interface ModrinthSearchResponse {
  hits: Array<{
    project_id: string;
    slug: string;
    author: string;
    title: string;
    description: string;
    categories?: string[];
    icon_url?: string;
    latest_version?: string;
    client_side?: ModrinthSideSupport;
    server_side?: ModrinthSideSupport;
  }>;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  icon_url?: string;
  project_type?: string;
  client_side?: ModrinthSideSupport;
  server_side?: ModrinthSideSupport;
}

export interface ModrinthDependency {
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
  project_id?: string;
  version_id?: string;
}

export interface ModrinthVersion {
  id: string;
  name?: string;
  version_type: 'release' | 'beta' | 'alpha';
  date_published: string;
  game_versions: string[];
  loaders: string[];
  dependencies?: ModrinthDependency[];
  files: Array<{
    url: string;
    primary?: boolean;
  }>;
}

export type ResolvedModWithDeps = {
  mod: ManagedMod;
  requiredDependencies: string[];
};

export type ManagedResourcePack = {
  kind: 'resourcepack';
  name: string;
  provider: 'modrinth' | 'direct';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
  iconUrl?: string;
  slug?: string;
};

export type ManagedShaderPack = {
  kind: 'shaderpack';
  name: string;
  provider: 'modrinth' | 'direct';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
  iconUrl?: string;
  slug?: string;
};

export type BootstrapAsset = {
  kind: 'resourcepack' | 'shaderpack';
  name: string;
  provider?: 'modrinth' | 'direct';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
  iconUrl?: string;
  slug?: string;
};

export type ModrinthSearchHit = {
  projectId: string;
  title: string;
  description: string;
  iconUrl: string | undefined;
  slug: string;
  author: string;
  categories: string[] | undefined;
  latestVersion: string | undefined;
  clientSide: ModrinthSideSupport | undefined;
  serverSide: ModrinthSideSupport | undefined;
};

export type FabricLoaderInfo = {
  version: string;
  stable: boolean;
};
