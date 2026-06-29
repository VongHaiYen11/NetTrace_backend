import { z } from 'zod';
import { CommonAnalyticsFilterSchema } from './shared.js';

const EXPORT_COLUMNS = [
  'alarm_id',
  'time_created',
  'time_solved',
  'status',
  'severity',
  'error_code',
  'error_name',
  'error_domain',
  'error_description',
  'error_default_severity',
  'device_id',
  'device_name',
  'device_type',
  'vendor_id',
  'station_name',
  'station_id',
  'station_province',
  'vendor_name',
  'vendor_country',
  'ip_address',
  'longitude',
  'latitude',
  'raw_log',
  'description',
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

export const ExportSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json']),
  columns: z.array(z.enum(EXPORT_COLUMNS)).optional(),
  filters: CommonAnalyticsFilterSchema.extend({
    sort_by: z.enum(['timestamp', 'severity', 'status']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
    limit: z.number().int().min(1).optional(),
  })
    .optional()
    .default({}),
});
