import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createPresetSchema = z.object({
  preset_name: z.string().trim().min(1).max(255),
  position: z.coerce.number().int().min(0).default(0),
  chart_type: z.string().trim().min(1).max(100),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: nullableText(50),
  severity: nullableText(50),
  error_code: nullableText(50),
  vendor: nullableText(100),
  device_type: nullableText(50),
});

export const listPresetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updatePresetSchema = createPresetSchema;

export const deletePresetsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});
