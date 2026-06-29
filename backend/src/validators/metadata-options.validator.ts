import { z } from 'zod';

export const MetadataOptionsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
