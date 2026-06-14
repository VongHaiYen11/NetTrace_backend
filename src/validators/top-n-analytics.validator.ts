import { z } from 'zod';
import { DateStringSchema } from './shared.js';

const TOP_N_BY = ['device', 'error_code'] as const;

export const TopNSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  by: z.enum(TOP_N_BY).default('device'),
  n: z.preprocess(
    (val) => (val === undefined ? 10 : Number(val)),
    z.number().int().min(1).max(1000).default(10),
  ),
});
