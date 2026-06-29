import { validateTimeRange } from '../validators/shared.js';
import { QueryAlarmsSchema } from '../validators/query-alarms.validator.js';
import { SummarySchema } from '../validators/summary.validator.js';
import { AnalyticsQuerySchema } from '../validators/analytics-query.validator.js';
import { HeatmapSchema } from '../validators/heatmap.validator.js';
import { ExportSchema } from '../validators/export.validator.js';
import { MetadataOptionsSchema } from '../validators/metadata-options.validator.js';
import { createPresetSchema, listPresetsQuerySchema } from '../validators/preset.validator.js';

describe('Validation Layer Tests', () => {
  describe('Time Range Custom Validator', () => {
    it('should validate standard 7-day range when timestamps are missing', () => {
      const result = validateTimeRange();
      expect(result.isValid).toBe(true);
      expect(result.from).toBeInstanceOf(Date);
      expect(result.to).toBeInstanceOf(Date);

      const diffMs = result.to!.getTime() - result.from!.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('should validate user-defined valid ranges', () => {
      const result = validateTimeRange('2026-06-10T00:00:00Z', '2026-06-12T00:00:00Z');
      expect(result.isValid).toBe(true);
      expect(result.from!.toISOString()).toBe('2026-06-10T00:00:00.000Z');
      expect(result.to!.toISOString()).toBe('2026-06-12T00:00:00.000Z');
    });

    it('should auto-expand date-only range to cover full day(s)', () => {
      const result = validateTimeRange('2026-06-15', '2026-06-15');
      expect(result.isValid).toBe(true);
      expect(result.from!.toISOString()).toBe('2026-06-15T00:00:00.000Z');
      expect(result.to!.toISOString()).toBe('2026-06-15T23:59:59.999Z');
    });

    it('should reject when from_time is after to_time', () => {
      const result = validateTimeRange('2026-06-15T00:00:00Z', '2026-06-12T00:00:00Z');
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_TIME_RANGE');
      expect(result.message).toContain('earlier than');
    });

    it('should allow ranges longer than 90 days for service-side chunking', () => {
      const result = validateTimeRange('2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z');
      expect(result.isValid).toBe(true);
      expect(result.from!.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(result.to!.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });
  });

  describe('QueryAlarmsSchema', () => {
    it('should parse valid parameters and supply defaults', () => {
      const parsed = QueryAlarmsSchema.parse({});
      expect(parsed.limit).toBe(100);
      expect(parsed.offset).toBe(0);
      expect(parsed.sort_by).toBe('timestamp');
      expect(parsed.sort_order).toBe('desc');
    });

    it('should parse array filters correctly from strings', () => {
      const parsed = QueryAlarmsSchema.parse({
        severity: 'critical,major',
        status: 'active',
      });
      expect(parsed.severity).toEqual(['critical', 'major']);
      expect(parsed.status).toEqual(['active']);
    });

    it('should reject limit higher than 1000', () => {
      const result = QueryAlarmsSchema.safeParse({ limit: '1001' });
      expect(result.success).toBe(false);
    });

    it('should parse performance controls with backward-compatible defaults', () => {
      const defaults = QueryAlarmsSchema.parse({});
      expect(defaults.include_total).toBe(true);
      expect(defaults.detail_level).toBe('full');

      const parsed = QueryAlarmsSchema.parse({
        include_total: 'false',
        detail_level: 'compact',
      });
      expect(parsed.include_total).toBe(false);
      expect(parsed.detail_level).toBe('compact');
    });

    it('should parse alarm search parameters for one whitelisted field', () => {
      const parsed = QueryAlarmsSchema.parse({
        search: 'Core Switch',
        search_field: 'device_type',
      });
      expect(parsed.search).toBe('Core Switch');
      expect(parsed.search_field).toBe('device_type');

      const invalid = QueryAlarmsSchema.safeParse({
        search: 'Core Switch',
        search_field: 'all',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('SummarySchema', () => {
    it('should accept valid filter params', () => {
      const parsed = SummarySchema.parse({
        severity: 'critical',
        device_type: 'wifi,router',
      });
      expect(parsed.severity).toEqual(['critical']);
      expect(parsed.device_type).toEqual(['wifi', 'router']);
    });
  });

  describe('AnalyticsQuerySchema', () => {
    it('should accept valid metrics and group_by values', () => {
      const parsed = AnalyticsQuerySchema.parse({
        metric: 'count',
        group_by: ['severity', 'device_type'],
        time_bucket: 'day',
        filters: {
          severity: 'critical',
        },
      });
      expect(parsed.metric).toBe('count');
      expect(parsed.group_by).toEqual(['severity', 'device_type']);
      expect(parsed.time_bucket).toBe('day');
      expect(parsed.filters.severity).toEqual(['critical']);
    });

    it('should reject invalid metrics', () => {
      const result = AnalyticsQuerySchema.safeParse({
        metric: 'invalid_metric',
      });
      expect(result.success).toBe(false);
    });

    it('should reject group_by array larger than 3', () => {
      const result = AnalyticsQuerySchema.safeParse({
        metric: 'count',
        group_by: ['severity', 'status', 'error_code', 'device'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('HeatmapSchema', () => {
    it('should validate valid mode and filters', () => {
      const parsed = HeatmapSchema.parse({
        mode: 'weekday',
        filters: {
          severity: 'critical',
        },
      });
      expect(parsed.mode).toBe('weekday');
      expect(parsed.filters.severity).toEqual(['critical']);
    });

    it('should reject invalid modes', () => {
      const result = HeatmapSchema.safeParse({
        mode: 'invalid_mode',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ExportSchema', () => {
    it('should accept supported export formats', () => {
      for (const format of ['csv', 'xlsx', 'json']) {
        expect(ExportSchema.parse({ format }).format).toBe(format);
      }
    });

    it('should reject other export formats', () => {
      expect(ExportSchema.safeParse({ format: 'xml' }).success).toBe(false);
    });

    it('should accept sort and limit in filters', () => {
      const parsed = ExportSchema.parse({
        format: 'csv',
        filters: {
          sort_by: 'severity',
          sort_order: 'asc',
          limit: 100,
        },
      });
      expect(parsed.filters.sort_by).toBe('severity');
      expect(parsed.filters.sort_order).toBe('asc');
      expect(parsed.filters.limit).toBe(100);
    });
  });

  describe('MetadataOptionsSchema', () => {
    it('should parse searchable metadata option queries', () => {
      const parsed = MetadataOptionsSchema.parse({ search: 'Cisco', limit: '12' });
      expect(parsed.search).toBe('Cisco');
      expect(parsed.limit).toBe(12);
    });

    it('should default metadata option limit', () => {
      expect(MetadataOptionsSchema.parse({}).limit).toBe(20);
    });
  });

  describe('Preset schemas', () => {
    it('creates an unassigned preset without widget-owned dates', () => {
      const parsed = createPresetSchema.parse({
        preset_name: 'Critical alarms',
        chart_type: 'line',
        metric: 'count',
      });
      expect(parsed.preset_name).toBe('Critical alarms');
      expect(parsed.chart_type).toBe('line');
      expect(parsed.metric).toBe('count');
    });

    it('validates preset pagination defaults and limits', () => {
      expect(listPresetsQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
      expect(listPresetsQuerySchema.safeParse({ limit: 1001 }).success).toBe(false);
    });

    it('requires a preset name for standalone preset creation', () => {
      expect(createPresetSchema.safeParse({ chart_type: 'line' }).success).toBe(false);
    });
  });
});
