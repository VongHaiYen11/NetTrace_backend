import { z } from 'zod';
import { CommonAnalyticsFilterSchema } from './shared.js';

export const HeatmapSchema = z.object({
  mode: z.enum(['weekday', 'calendar']),
  filters: CommonAnalyticsFilterSchema.optional().default({}),
});
