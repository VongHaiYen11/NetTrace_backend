import { z } from 'zod';

export const WidgetSchema = z.object({
  device_id: z.string().min(1, 'device_id is required').max(20),
  position: z.number().int().min(0),
  chart_type: z.string().min(1, 'chart_type is required').max(100),
  status: z.string().max(50).optional().nullable(),
  severity: z.string().max(50).optional().nullable(),
  error_code: z.string().max(50).optional().nullable(),
  vendor_id: z.string().max(20).optional().nullable(),
  device_type: z.string().max(50).optional().nullable(),
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
