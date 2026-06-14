import { z } from 'zod';
import { DateStringSchema } from './shared.js';

const SORT_BY_WHITELIST = ['timestamp', 'severity', 'status'] as const;
const SORT_ORDER_WHITELIST = ['asc', 'desc'] as const;

export const QueryAlarmsSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  cursor_time: DateStringSchema.optional(),
  cursor_id: z.string().optional(),
  limit: z.preprocess(
    (val) => (val === undefined ? 100 : Number(val)),
    z.number().int().min(1).max(1000).default(100),
  ),
  severity: z.string().optional(),
  status: z.string().optional(),
  device_id: z.string().optional(),
  error_code: z.string().optional(),
  sort_by: z.enum(SORT_BY_WHITELIST).default('timestamp'),
  sort_order: z.enum(SORT_ORDER_WHITELIST).default('desc'),
});
