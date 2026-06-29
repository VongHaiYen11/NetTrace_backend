import { HeatmapRepository } from '../repositories/heatmap.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ServiceMetrics, splitDateRangeIntoChunks } from './shared.js';

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
      const { deviceIds } = await this.deviceRepo.getDeviceIdsByFilters({
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

    const chunks = splitDateRangeIntoChunks(from_time, to_time);
    metrics.time_range_chunks = chunks.length;
    const results = await Promise.all(
      chunks.map((chunk) =>
        this.heatmapRepo.getHeatmap({
          from_time: chunk.from_time,
          to_time: chunk.to_time,
          mode,
          severity,
          status,
          device_id: finalDeviceIds,
          error_code,
        }),
      ),
    );
    const rows = results.flatMap((result) => {
      metrics.clickhouse_query_time_ms += result.durationMs;
      return result.rows;
    });

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
      const byCell = new Map<string, { day_of_week: unknown; hour: unknown; count: number }>();
      rows.forEach((r) => {
        const day = r.day_of_week ?? 0;
        const hour = r.hour ?? 0;
        const key = `${day}:${hour}`;
        const current = byCell.get(key) ?? { day_of_week: day, hour, count: 0 };
        current.count += r.count !== undefined ? Number(r.count) : 0;
        byCell.set(key, current);
      });

      const data = Array.from(byCell.values()).map((r) => {
        const x = r.hour !== undefined ? Number(r.hour) : 0;
        const dayNum = Number(r.day_of_week);
        const y = weekdayNames[dayNum - 1] || 'Unknown';
        const value = Number(r.count);
        return { x, y, value };
      });
      metrics.records_returned += data.length;
      return data;
    } else {
      const byDay = new Map<string, number>();
      rows.forEach((r) => {
        const day = r.day ? String(r.day) : '';
        byDay.set(day, (byDay.get(day) ?? 0) + (r.count !== undefined ? Number(r.count) : 0));
      });
      const data = Array.from(byDay.entries()).map(([day, value]) => {
        return { day, value };
      });
      metrics.records_returned += data.length;
      return data;
    }
  }
}
