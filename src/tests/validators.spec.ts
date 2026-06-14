import { validateTimeRange } from '../validators/shared.js';
import { QueryAlarmsSchema } from '../validators/query-alarms.validator.js';
import { TimeSeriesCountSchema } from '../validators/time-series-count.validator.js';
import { TimeSeriesDurationSchema } from '../validators/time-series-duration.validator.js';
import { TopNSchema } from '../validators/top-n-analytics.validator.js';
import { RatioSchema } from '../validators/ratio-analytics.validator.js';

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

    it('should reject when from_time is after to_time', () => {
      const result = validateTimeRange('2026-06-15T00:00:00Z', '2026-06-12T00:00:00Z');
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_TIME_RANGE');
      expect(result.message).toContain('earlier than');
    });

    it('should reject when time range exceeds 90 days', () => {
      const result = validateTimeRange('2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z');
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('TIME_RANGE_EXCEEDED');
    });
  });

  describe('QueryAlarmsSchema', () => {
    it('should parse valid parameters and supply defaults', () => {
      const parsed = QueryAlarmsSchema.parse({});
      expect(parsed.limit).toBe(100);
      expect(parsed.sort_by).toBe('timestamp');
      expect(parsed.sort_order).toBe('desc');
      expect(parsed.cursor_time).toBeUndefined();
      expect(parsed.cursor_id).toBeUndefined();
    });

    it('should accept valid cursor parameters', () => {
      const parsed = QueryAlarmsSchema.parse({
        cursor_time: '2026-06-14T08:00:00Z',
        cursor_id: 'a123',
      });
      expect(parsed.cursor_time).toBe('2026-06-14T08:00:00Z');
      expect(parsed.cursor_id).toBe('a123');
    });

    it('should reject limit higher than 1000', () => {
      const result = QueryAlarmsSchema.safeParse({ limit: '1001' });
      expect(result.success).toBe(false);
    });
  });

  describe('TimeSeriesCountSchema', () => {
    it('should accept hour and day intervals', () => {
      expect(TimeSeriesCountSchema.parse({ interval: 'hour' }).interval).toBe('hour');
      expect(TimeSeriesCountSchema.parse({ interval: 'day' }).interval).toBe('day');
    });

    it('should reject other intervals', () => {
      expect(TimeSeriesCountSchema.safeParse({ interval: 'month' }).success).toBe(false);
    });
  });

  describe('TimeSeriesDurationSchema', () => {
    it('should accept day, month, and year intervals', () => {
      expect(TimeSeriesDurationSchema.parse({ interval: 'day' }).interval).toBe('day');
      expect(TimeSeriesDurationSchema.parse({ interval: 'month' }).interval).toBe('month');
      expect(TimeSeriesDurationSchema.parse({ interval: 'year' }).interval).toBe('year');
    });

    it('should reject other intervals', () => {
      expect(TimeSeriesDurationSchema.safeParse({ interval: 'hour' }).success).toBe(false);
    });
  });

  describe('TopNSchema', () => {
    it('should validate valid parameters', () => {
      const parsed = TopNSchema.parse({ by: 'device', n: '50' });
      expect(parsed.by).toBe('device');
      expect(parsed.n).toBe(50);
    });

    it('should reject invalid dimensions', () => {
      const result = TopNSchema.safeParse({ by: 'severity' });
      expect(result.success).toBe(false);
    });
  });

  describe('RatioSchema', () => {
    it('should accept all valid composition dimensions', () => {
      expect(RatioSchema.parse({ by: 'severity' }).by).toBe('severity');
      expect(RatioSchema.parse({ by: 'type' }).by).toBe('type');
      expect(RatioSchema.parse({ by: 'station' }).by).toBe('station');
      expect(RatioSchema.parse({ by: 'site' }).by).toBe('site');
      expect(RatioSchema.parse({ by: 'region' }).by).toBe('region');
    });

    it('should reject invalid composition dimensions', () => {
      expect(RatioSchema.safeParse({ by: 'invalid_dim' }).success).toBe(false);
    });
  });
});
