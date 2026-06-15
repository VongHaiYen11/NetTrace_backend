import { z } from 'zod';

export const DateStringSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

export const QueryArraySchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}, z.array(z.string()).optional());

export const CommonAnalyticsFilterSchema = z.object({
  from_time: DateStringSchema.optional(),
  to_time: DateStringSchema.optional(),
  severity: QueryArraySchema,
  status: QueryArraySchema,
  device_id: QueryArraySchema,
  error_code: QueryArraySchema,
  // Federated postgres filters:
  device_type: QueryArraySchema,
  vendor: QueryArraySchema,
  station: QueryArraySchema,
  province: QueryArraySchema,
});

export function validateTimeRange(fromStr?: string, toStr?: string) {
  const now = new Date();
  const to = toStr ? new Date(toStr) : now;
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (from.getTime() > to.getTime()) {
    return {
      isValid: false,
      code: 'INVALID_TIME_RANGE',
      message: 'from_time must be earlier than to_time',
    };
  }

  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 90) {
    return {
      isValid: false,
      code: 'TIME_RANGE_EXCEEDED',
      message: 'Time range cannot exceed 90 days',
    };
  }

  return {
    isValid: true,
    from,
    to,
  };
}

