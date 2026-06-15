import { HeatmapRepository, HeatmapParams } from '../repositories/heatmap.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ServiceMetrics } from './shared.js';

export class HeatmapService {
  constructor(
    private readonly heatmapRepo: HeatmapRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  async getHeatmap(
    params: {
      mode: 'weekday' | 'calendar';
      filters?: {
        from_time?: Date;
        to_time?: Date;
        severity?: string[];
        status?: string[];
        device_id?: string[];
        error_code?: string[];
        device_type?: string[];
        vendor?: string[];
        station?: string[];
        province?: string[];
      };
      from_time?: Date;
      to_time?: Date;
      severity?: string[];
      status?: string[];
      device_id?: string[];
      error_code?: string[];
      device_type?: string[];
      vendor?: string[];
      station?: string[];
      province?: string[];
    },
    metrics: ServiceMetrics,
  ) {
    const mode = params.mode;
    const filters = params.filters || {};

    const from_time = filters.from_time || params.from_time;
    const to_time = filters.to_time || params.to_time;
    const severity = filters.severity || params.severity;
    const status = filters.status || params.status;
    const device_id = filters.device_id || params.device_id;
    const error_code = filters.error_code || params.error_code;
    const device_type = filters.device_type || params.device_type;
    const vendor = filters.vendor || params.vendor;
    const station = filters.station || params.station;
    const province = filters.province || params.province;

    if (!from_time || !to_time) {
      throw new Error('Missing from_time or to_time in heatmap parameters');
    }

    let finalDeviceIds = device_id;

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

      if (device_id && device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          return [];
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    const { rows, durationMs } = await this.heatmapRepo.getHeatmap({
      from_time,
      to_time,
      mode,
      severity,
      status,
      device_id: finalDeviceIds,
      error_code,
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

    if (mode === 'weekday') {
      return rows.map((r) => {
        const x = r.hour !== undefined ? Number(r.hour) : 0;
        const dayNum = Number(r.day_of_week);
        const y = weekdayNames[dayNum - 1] || 'Unknown';
        const value = r.count !== undefined ? Number(r.count) : 0;
        return { x, y, value };
      });
    } else {
      return rows.map((r) => {
        const day = r.day ? String(r.day) : '';
        const value = r.count !== undefined ? Number(r.count) : 0;
        return { day, value };
      });
    }
  }
}
