import { SummaryRepository, SummaryParams } from '../repositories/summary.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ServiceMetrics, splitDateRangeIntoChunks } from './shared.js';

export class SummaryService {
  constructor(
    private readonly summaryRepo: SummaryRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  async getSummary(
    params: SummaryParams & {
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
      const { deviceIds } = await this.deviceRepo.getDeviceIdsByFilters({
        device_type,
        vendor,
        station,
        province,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgFilter);

      if (deviceIds.length === 0) {
        // No devices match the metadata filters, so summary numbers are all 0
        return {
          totalAlarms: 0,
          activeAlarms: 0,
          closedAlarms: 0,
          criticalAlarms: 0,
          affectedDevices: 0,
        };
      }

      // Intersect with device_id filter if present
      if (params.device_id && params.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = params.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          return {
            totalAlarms: 0,
            activeAlarms: 0,
            closedAlarms: 0,
            criticalAlarms: 0,
            affectedDevices: 0,
          };
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    const chunks = splitDateRangeIntoChunks(params.from_time, params.to_time);
    metrics.time_range_chunks = chunks.length;
    const results = await Promise.all(
      chunks.map((chunk) =>
        this.summaryRepo.getSummary({
          from_time: chunk.from_time,
          to_time: chunk.to_time,
          severity: params.severity,
          status: params.status,
          device_id: finalDeviceIds,
          error_code: params.error_code,
        }),
      ),
    );

    const affectedDeviceIds = new Set<string>();
    const summary = results.reduce(
      (acc, result) => {
        metrics.clickhouse_query_time_ms += result.durationMs;
        acc.totalAlarms += result.summary.totalAlarms;
        acc.activeAlarms += result.summary.activeAlarms;
        acc.closedAlarms += result.summary.closedAlarms;
        acc.criticalAlarms += result.summary.criticalAlarms;
        result.affectedDeviceIds.forEach((deviceId) => affectedDeviceIds.add(deviceId));
        return acc;
      },
      {
        totalAlarms: 0,
        activeAlarms: 0,
        closedAlarms: 0,
        criticalAlarms: 0,
        affectedDevices: 0,
      },
    );
    summary.affectedDevices = affectedDeviceIds.size;
    metrics.records_returned += 1;

    return summary;
  }
}
