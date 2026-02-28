import { z } from 'zod';

export const ProviderSchema = z.enum(['modrinth', 'direct', 'curseforge']);
export type Provider = z.infer<typeof ProviderSchema>;

export const SideSchema = z.enum(['client', 'server', 'both']).default('client');
export type Side = z.infer<typeof SideSchema>;

const BaseFileSchema = z.object({
  kind: z.enum(['mod', 'resourcepack', 'shaderpack', 'config']),
  name: z.string().min(1),
  url: z.url(),
  sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

export const LockItemSchema = BaseFileSchema.extend({
  kind: z.literal('mod'),
  provider: ProviderSchema,
  side: SideSchema,
  projectId: z.string().min(1).optional(),
  versionId: z.string().min(1).optional(),
});
export type LockItem = z.infer<typeof LockItemSchema>;

export const ResourcePackSchema = BaseFileSchema.extend({
  kind: z.literal('resourcepack'),
});
export type ResourcePack = z.infer<typeof ResourcePackSchema>;

export const ShaderPackSchema = BaseFileSchema.extend({
  kind: z.literal('shaderpack'),
});
export type ShaderPack = z.infer<typeof ShaderPackSchema>;

export const ConfigTemplateSchema = BaseFileSchema.extend({
  kind: z.literal('config'),
});
export type ConfigTemplate = z.infer<typeof ConfigTemplateSchema>;

export const DefaultServerSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
});
export type DefaultServer = z.infer<typeof DefaultServerSchema>;

export const RuntimeHintsSchema = z.object({
  javaMajor: z.number().int().min(8).max(23),
  minMemoryMb: z.number().int().min(512),
  maxMemoryMb: z.number().int().min(1024),
}).refine((runtime) => runtime.maxMemoryMb >= runtime.minMemoryMb, {
  message: 'maxMemoryMb must be greater than or equal to minMemoryMb',
});
export type RuntimeHints = z.infer<typeof RuntimeHintsSchema>;

export const BrandingSchema = z.object({
  serverName: z.string().min(1),
  logoUrl: z.url().optional(),
  backgroundUrl: z.url().optional(),
  newsUrl: z.url().optional(),
});
export type Branding = z.infer<typeof BrandingSchema>;

export const FancyMenuSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  playButtonLabel: z.string().min(1).default('Play'),
  hideSingleplayer: z.boolean().default(true),
  hideMultiplayer: z.boolean().default(true),
  hideRealms: z.boolean().default(true),
  titleText: z.string().min(1).optional(),
  subtitleText: z.string().min(1).optional(),
  logoUrl: z.url().optional(),
  configUrl: z.url().optional(),
  configSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  assetsUrl: z.url().optional(),
  assetsSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).optional(),
});
export type FancyMenuSettings = z.infer<typeof FancyMenuSettingsSchema>;

export const ProfileLockSchema = z.object({
  profileId: z.string().min(1),
  version: z.number().int().positive(),
  minecraftVersion: z.string().min(1),
  loader: z.enum(['fabric', 'forge']).default('fabric'),
  loaderVersion: z.string().min(1),
  defaultServer: DefaultServerSchema,
  items: z.array(LockItemSchema),
  resources: z.array(ResourcePackSchema).default([]),
  shaders: z.array(ShaderPackSchema).default([]),
  configs: z.array(ConfigTemplateSchema).default([]),
  runtimeHints: RuntimeHintsSchema,
  branding: BrandingSchema,
  fancyMenu: FancyMenuSettingsSchema.default({
    enabled: false,
    playButtonLabel: 'Play',
    hideSingleplayer: true,
    hideMultiplayer: true,
    hideRealms: true,
  }),
});
export type ProfileLock = z.infer<typeof ProfileLockSchema>;

export const LockBundleItemSchema = z.discriminatedUnion('kind', [
  LockItemSchema,
  ResourcePackSchema,
  ShaderPackSchema,
  ConfigTemplateSchema,
]);
export type LockBundleItem = z.infer<typeof LockBundleItemSchema>;
