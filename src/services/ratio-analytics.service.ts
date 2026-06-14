import {
  RatioAnalyticsRepository,
  RatioParams,
} from '../repositories/ratio-analytics.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ServiceMetrics } from './shared.js';

export class RatioAnalyticsService {
  constructor(
    private readonly ratioRepo: RatioAnalyticsRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  async getRatioAnalytics(
    params: RatioParams & { by: 'severity' | 'type' | 'station' | 'site' | 'region' },
    metrics: ServiceMetrics,
  ) {
    const { by } = params;

    // A. Direct ClickHouse aggregation for severity
    if (by === 'severity') {
      const { rows, durationMs } = await this.ratioRepo.getRatioBySeverity(params);
      metrics.clickhouse_query_time_ms += durationMs;
      metrics.records_returned += rows.length;

      const total = rows.reduce((sum, r) => sum + r.count, 0);
      return rows.map((r) => ({
        severity: r.severity,
        count: r.count,
        percentage: total > 0 ? Math.round((r.count / total) * 10000) / 100 : 0,
      }));
    }

    // B. Federated aggregation for Postgres metadata (type, station, site, region)
    const { rows: clickhouseRows, durationMs: chDuration } =
      await this.ratioRepo.getRatioByDevice(params);
    metrics.clickhouse_query_time_ms += chDuration;

    if (clickhouseRows.length === 0) return [];

    const deviceIds = clickhouseRows.map((r) => r.device_id);

    const startPg = performance.now();
    const { devices } = await this.deviceRepo.getDevicesByIds(deviceIds);
    metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);

    const deviceMap = devices.reduce<Record<string, DeviceMetadata>>((acc, d) => {
      acc[d.device_id] = d;
      return acc;
    }, {});

    const aggregationMap: Record<string, number> = {};
    let grandTotal = 0;

    for (const chRow of clickhouseRows) {
      const dev = deviceMap[chRow.device_id];
      let dimensionValue = 'Unknown';

      if (dev) {
        if (by === 'type') dimensionValue = dev.device_type || 'Unknown';
        else if (by === 'station') dimensionValue = dev.station_name || 'Unknown';
        else if (by === 'site') dimensionValue = dev.station_id || 'Unknown';
        else if (by === 'region') dimensionValue = dev.station_province || 'Unknown';
      }

      aggregationMap[dimensionValue] = (aggregationMap[dimensionValue] || 0) + chRow.count;
      grandTotal += chRow.count;
    }

    const result = Object.entries(aggregationMap).map(([key, count]) => {
      const percentage = grandTotal > 0 ? Math.round((count / grandTotal) * 10000) / 100 : 0;

      const payload: { count: number; percentage: number; [key: string]: string | number } = {
        count,
        percentage,
      };
      if (by === 'type') payload.device_type = key;
      else if (by === 'station') payload.station_name = key;
      else if (by === 'site') payload.station_id = key;
      else if (by === 'region') payload.region_name = key;

      return payload;
    });

    result.sort((a, b) => b.count - a.count);
    metrics.records_returned += result.length;

    return result;
  }
}
