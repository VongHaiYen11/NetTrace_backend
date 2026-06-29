import { z } from 'zod';

export const DateStringSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

export const QueryArraySchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
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
  let finalFromStr = fromStr;
  let finalToStr = toStr;

  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

  // If input format is date-only (YYYY-MM-DD), auto-expand to start/end of day
  if (fromStr && dateOnlyRegex.test(fromStr)) {
    finalFromStr = `${fromStr}T00:00:00.000Z`;
  }
  if (toStr && dateOnlyRegex.test(toStr)) {
    finalToStr = `${toStr}T23:59:59.999Z`;
  }

  const now = new Date();
  const to = finalToStr ? new Date(finalToStr) : now;
  const from = finalFromStr
    ? new Date(finalFromStr)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (from.getTime() > to.getTime()) {
    return {
      isValid: false,
      code: 'INVALID_TIME_RANGE',
      message: 'from_time must be earlier than to_time',
    };
  }

  return {
    isValid: true,
    from,
    to,
  };
}
