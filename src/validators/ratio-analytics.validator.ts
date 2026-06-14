import { z } from 'zod';
import { DateStringSchema } from './shared.js';

const RATIO_BY = ['severity', 'type', 'station', 'site', 'region'] as const;

export const RatioSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  by: z.enum(RATIO_BY).default('severity'),
});
