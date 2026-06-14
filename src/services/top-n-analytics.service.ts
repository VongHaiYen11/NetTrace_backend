import { TopNAnalyticsRepository, TopNParams } from '../repositories/top-n-analytics.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ErrorRepository, ErrorMetadata } from '../repositories/error.repository.js';
import { ServiceMetrics } from './shared.js';

export class TopNAnalyticsService {
  constructor(
    private readonly topNRepo: TopNAnalyticsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async getTopNAnalytics(params: TopNParams, metrics: ServiceMetrics) {
    const { rows, durationMs: chDuration } = await this.topNRepo.getTopN(params);
    metrics.clickhouse_query_time_ms += chDuration;
    metrics.records_returned += rows.length;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.entity_id);
    const startPg = performance.now();

    if (params.by === 'device') {
      const { devices } = await this.deviceRepo.getDevicesByIds(ids);
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);

      const deviceMap = devices.reduce<Record<string, DeviceMetadata>>((acc, d) => {
        acc[d.device_id] = d;
        return acc;
      }, {});

      return rows.map((row) => {
        const dev = deviceMap[row.entity_id];
        const label = dev ? `${dev.name} (${dev.station_name || 'No Station'})` : row.entity_id;
        return {
          device_id: row.entity_id,
          alarm_count: row.alarm_count,
          label,
          device_details: dev || null,
        };
      });
    } else {
      const { errors } = await this.errorRepo.getErrorsByCodes(ids);
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);

      const errorMap = errors.reduce<Record<string, ErrorMetadata>>((acc, e) => {
        acc[e.error_code] = e;
        return acc;
      }, {});

      return rows.map((row) => {
        const err = errorMap[row.entity_id];
        const label = err ? err.name : row.entity_id;
        return {
          error_code: row.entity_id,
          alarm_count: row.alarm_count,
          label,
          error_details: err || null,
        };
      });
    }
  }
}
