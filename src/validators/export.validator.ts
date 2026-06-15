import { z } from 'zod';
import { CommonAnalyticsFilterSchema } from './shared.js';

export const ExportSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  filters: CommonAnalyticsFilterSchema.optional().default({}),
});
