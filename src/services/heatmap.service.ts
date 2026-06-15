import { HeatmapRepository, HeatmapParams } from '../repositories/heatmap.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ServiceMetrics } from './shared.js';

export class HeatmapService {
  constructor(
    private readonly heatmapRepo: HeatmapRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  async getHeatmap(
    params: HeatmapParams & {
      device_type?: string[];
      vendor?: string[];
      station?: string[];
      province?: string[];
    },
    metrics: ServiceMetrics,
  ) {
    const { device_type, vendor, station, province } = params;
    let finalDeviceIds = params.device_id;

    // 1. Resolve PostgreSQL device filters if present
    if (
      (device_type && device_type.length > 0) ||
      (vendor && vendor.length > 0) ||
      (station && station.length > 0) ||
      (province && province.length > 0)
    ) {
      const startPgFilter = performance.now();
      const { deviceIds, durationMs } = await this.deviceRepo.getDeviceIdsByFilters({
        device_type,
        vendor,
        station,
        province,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgFilter);

      if (deviceIds.length === 0) {
        return [];
      }

      if (params.device_id && params.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = params.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          return [];
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    const { rows, durationMs } = await this.heatmapRepo.getHeatmap({
      from_time: params.from_time,
      to_time: params.to_time,
      mode: params.mode,
      severity: params.severity,
      status: params.status,
      device_id: finalDeviceIds,
      error_code: params.error_code,
    });

    metrics.clickhouse_query_time_ms += durationMs;
    metrics.records_returned += rows.length;

    // 2. Map response shape
    const weekdayNames = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    return rows.map((r) => {
      const x = r.hour !== undefined ? Number(r.hour) : 0;
      const value = r.count !== undefined ? Number(r.count) : 0;

      let y: string | number = '';
      if (params.mode === 'weekday') {
        const dayNum = Number(r.day_of_week);
        y = weekdayNames[dayNum - 1] || 'Unknown';
      } else {
        y = r.day ? String(r.day) : '';
      }

      return { x, y, value };
    });
  }
}
