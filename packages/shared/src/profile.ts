import { z } from 'zod';
import { FancyMenuSettingsSchema } from './lockfile';

export const ProfileMetadataResponseSchema = z.object({
  profileId: z.string().min(1),
  version: z.number().int().positive(),
  minecraftVersion: z.string().min(1),
  loader: z.enum(['fabric', 'forge']),
  loaderVersion: z.string().min(1),
  lockUrl: z.url(),
  serverName: z.string().min(1),
  serverAddress: z.string().min(1),
  allowedMinecraftVersions: z.array(z.string().min(1)).default([]),
  fancyMenuEnabled: z.boolean().default(false),
  fancyMenu: FancyMenuSettingsSchema.optional(),
  signature: z.string().optional(),
});

export type ProfileMetadataResponse = z.infer<typeof ProfileMetadataResponseSchema>;
