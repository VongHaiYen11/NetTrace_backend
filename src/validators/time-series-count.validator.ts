import { z } from 'zod';
import { DateStringSchema } from './shared.js';

const TS_COUNT_INTERVAL = ['hour', 'day'] as const;

export const TimeSeriesCountSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  interval: z.enum(TS_COUNT_INTERVAL).default('hour'),
  severity: z.string().optional(),
  status: z.string().optional(),
  device_id: z.string().optional(),
});
