import { z } from 'zod';
import { CommonAnalyticsFilterSchema, DateStringSchema, QueryArraySchema } from './shared.js';

const EXPORT_COLUMNS = [
  'alarm_id',
  'time_created',
  'time_solved',
  'status',
  'severity',
  'error_code',
  'error_name',
  'error_domain',
  'device_id',
  'device_name',
  'device_type',
  'station_name',
  'station_province',
  'vendor_name',
  'raw_log',
  'description',
] as const;

export type ExportColumn = typeof EXPORT_COLUMNS[number];

export const ExportSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  columns: z.array(z.enum(EXPORT_COLUMNS)).optional(),
  filters: CommonAnalyticsFilterSchema.extend({
    sort_by: z.enum(['timestamp', 'severity', 'status']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
    limit: z.number().int().min(1).optional(),
  }).optional().default({}),
});

export const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  columns: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    },
    z.array(z.enum(EXPORT_COLUMNS)).optional()
  ),
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  severity: QueryArraySchema,
  status: QueryArraySchema,
  device_id: QueryArraySchema,
  error_code: QueryArraySchema,
  device_type: QueryArraySchema,
  vendor: QueryArraySchema,
  station: QueryArraySchema,
  province: QueryArraySchema,
  sort_by: z.enum(['timestamp', 'severity', 'status']).default('timestamp'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : Number(val)),
    z.number().int().min(1).optional(),
  ),
});
