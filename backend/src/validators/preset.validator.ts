import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createPresetSchema = z.object({
  preset_name: z.string().trim().min(1).max(255),
  chart_type: z.string().trim().min(1).max(100),
  metric: nullableText(50),
  group_by: nullableText(50),
  time_bucket: nullableText(50),
  heatmap_mode: nullableText(100),
  table_columns: nullableText(500),
  table_page_size: z.number().int().min(1).max(200).nullable().optional(),
  table_record_limit: z.number().int().min(1).max(1000).nullable().optional(),
});

export const listPresetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updatePresetSchema = createPresetSchema;

export const deletePresetsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});
