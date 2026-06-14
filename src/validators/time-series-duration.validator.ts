import { z } from 'zod';
import { DateStringSchema } from './shared.js';

const TS_DURATION_INTERVAL = ['day', 'month', 'year'] as const;

export const TimeSeriesDurationSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  interval: z.enum(TS_DURATION_INTERVAL).default('day'),
  severity: z.string().optional(),
  status: z.string().optional(),
  device_id: z.string().optional(),
});
