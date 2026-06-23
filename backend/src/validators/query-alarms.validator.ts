import { z } from 'zod';
import { DateStringSchema, QueryArraySchema } from './shared.js';

const SORT_BY_WHITELIST = ['timestamp', 'severity', 'status'] as const;
const SORT_ORDER_WHITELIST = ['asc', 'desc'] as const;
const SEARCH_FIELD_WHITELIST = [
  'alarm_id',
  'device_id',
  'device_name',
  'device_type',
  'error_code',
  'error_name',
  'severity',
  'status',
  'description',
  'raw_log',
] as const;
const parseBoolean = (val: unknown) => {
  if (val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() !== 'false';
  return Boolean(val);
};

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
  include_total: z.preprocess(parseBoolean, z.boolean().default(true)),
  detail_level: z.enum(['compact', 'full']).default('full'),
  search: z.string().trim().min(1).max(200).optional(),
  search_field: z.enum(SEARCH_FIELD_WHITELIST).default('alarm_id'),
});
