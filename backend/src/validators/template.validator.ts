import { z } from 'zod';

export const WidgetSchema = z.object({
  preset_id: z.number().int().positive().optional(),
  preset_name: z.string().trim().min(1).max(255).optional().nullable(),
  position: z.number().int().min(0),
  chart_type: z.string().min(1, 'chart_type is required').max(100).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  metric: z.string().max(50).optional().nullable(),
  group_by: z.string().max(50).optional().nullable(),
  time_bucket: z.string().max(50).optional().nullable(),
  heatmap_mode: z.string().max(100).optional().nullable(),
  table_columns: z.string().max(500).optional().nullable(),
  table_page_size: z.number().int().min(1).max(200).optional().nullable(),
  table_record_limit: z.number().int().min(1).max(1000).optional().nullable(),
}).superRefine((widget, ctx) => {
  if (!widget.preset_id && !widget.chart_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chart_type'],
      message: 'chart_type is required when preset_id is not provided',
    });
  }
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  selected_cards: z.string().optional().nullable(),
  widgets: z.array(WidgetSchema).default([]),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1, 'name is required').max(255).optional(),
  selected_cards: z.string().optional().nullable(),
  widgets: z.array(WidgetSchema).optional(),
});

export const getTemplatesQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : Number(val)),
    z.number().int().min(1).max(1000).default(20),
  ),
  offset: z.preprocess(
    (val) => (val === undefined ? 0 : Number(val)),
    z.number().int().min(0).default(0),
  ),
});

export const getTemplateParamsSchema = z.object({
  id: z.preprocess(
    (val) => Number(val),
    z.number().int().positive('Template ID must be a positive number'),
  ),
});
