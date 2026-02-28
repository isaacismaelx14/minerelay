import { z } from 'zod';

export const UpdateSummarySchema = z.object({
  add: z.number().int().nonnegative(),
  remove: z.number().int().nonnegative(),
  update: z.number().int().nonnegative(),
  keep: z.number().int().nonnegative(),
});
export type UpdateSummary = z.infer<typeof UpdateSummarySchema>;

export const UpdatesResponseSchema = z.object({
  hasUpdates: z.boolean(),
  from: z.number().int().nonnegative().nullable(),
  to: z.number().int().positive(),
  summary: UpdateSummarySchema,
});
export type UpdatesResponse = z.infer<typeof UpdatesResponseSchema>;

export const SyncOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'update', 'keep']),
  path: z.string().min(1),
  name: z.string().min(1),
  sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  fromSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  toSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/).optional(),
  url: z.url().optional(),
  kind: z.enum(['mod', 'resourcepack', 'shaderpack', 'config']),
});
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncPlanSchema = z.object({
  serverId: z.string().min(1),
  fromVersion: z.number().int().nonnegative().nullable(),
  toVersion: z.number().int().positive(),
  summary: UpdateSummarySchema,
  operations: z.array(SyncOperationSchema),
});
export type SyncPlan = z.infer<typeof SyncPlanSchema>;
