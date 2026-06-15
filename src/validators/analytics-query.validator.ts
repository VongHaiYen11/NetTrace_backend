import { z } from 'zod';
import { CommonAnalyticsFilterSchema } from './shared.js';

export const AnalyticsQuerySchema = z.object({
  metric: z.enum(['count', 'avg_duration', 'max_duration', 'affected_devices']),
  group_by: z.array(z.enum([
    'severity',
    'status',
    'error_code',
    'device',
    'device_type',
    'vendor',
    'station',
    'province'
  ])).max(3).default([]),
  time_bucket: z.enum(['hour', 'day', 'week', 'month', 'year']).nullable().optional(),
  filters: CommonAnalyticsFilterSchema.optional().default({}),
  limit: z.number().int().min(1).max(1000).default(20),
});
