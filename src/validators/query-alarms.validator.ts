import { z } from 'zod';
import { DateStringSchema, QueryArraySchema } from './shared.js';

const SORT_BY_WHITELIST = ['timestamp', 'severity', 'status'] as const;
const SORT_ORDER_WHITELIST = ['asc', 'desc'] as const;

export const QueryAlarmsSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  offset: z.preprocess(
    (val) => (val === undefined ? 0 : Number(val)),
    z.number().int().min(0).default(0),
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 100 : Number(val)),
    z.number().int().min(1).max(1000).default(100),
  ),
  severity: QueryArraySchema,
  status: QueryArraySchema,
  device_id: QueryArraySchema,
  error_code: QueryArraySchema,
  // Federated postgres filters:
  device_type: QueryArraySchema,
  vendor: QueryArraySchema,
  station: QueryArraySchema,
  province: QueryArraySchema,
  sort_by: z.enum(SORT_BY_WHITELIST).default('timestamp'),
  sort_order: z.enum(SORT_ORDER_WHITELIST).default('desc'),
});
