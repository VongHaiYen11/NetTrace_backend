import {
  QueryAlarmsRepository,
  QueryAlarmsParams,
} from '../repositories/query-alarms.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ErrorRepository, ErrorMetadata } from '../repositories/error.repository.js';
import { ServiceMetrics } from './shared.js';
import { config } from '../configs/database.config.js';
import { TtlMapCache } from './metadata-cache.js';

const deviceMetadataCache = new TtlMapCache<DeviceMetadata>(config.performance.metadataCacheTtlMs);
const errorMetadataCache = new TtlMapCache<ErrorMetadata>(config.performance.metadataCacheTtlMs);

export class QueryAlarmsService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async queryAlarms(
    params: QueryAlarmsParams & {
      device_type?: string[];
      vendor?: string[];
      station?: string[];
      province?: string[];
    },
    metrics: ServiceMetrics,
  ) {
    const { device_type, vendor, station, province } = params;
    let finalDeviceIds = params.device_id;
    metrics.include_total = params.include_total ?? true;
    metrics.detail_level = params.detail_level ?? 'full';

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
        // No devices match the metadata filters, so no alarms can exist
        return { alarms: [], total: 0 };
      }

      // If user also passed specific device_id filter, intersect them
      if (params.device_id && params.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = params.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          return { alarms: [], total: 0 };
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    // 2. Query ClickHouse with the resolved parameters
    const clickhouseParams: QueryAlarmsParams = {
      from_time: params.from_time,
      to_time: params.to_time,
      offset: params.offset,
      limit: params.limit,
      severity: params.severity,
      status: params.status,
      device_id: finalDeviceIds,
      error_code: params.error_code,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    };

    const {
      alarms,
      total,
      durationMs: chDuration,
    } = await this.queryAlarmsRepo.queryAlarms(clickhouseParams);
    metrics.clickhouse_query_time_ms += chDuration;
    metrics.records_returned += alarms.length;
    metrics.clickhouse_rows_returned = (metrics.clickhouse_rows_returned ?? 0) + alarms.length;

    if (alarms.length === 0) {
      return { alarms: [], total };
    }

    // 3. Extract unique IDs from alarms result set
    const resultDeviceIds = [...new Set(alarms.map((a) => a.device_id))];
    const resultErrorCodes = [...new Set(alarms.map((a) => a.error_code))];
    const missingDeviceIds = resultDeviceIds.filter((id) => !deviceMetadataCache.get(id));
    const missingErrorCodes = resultErrorCodes.filter((code) => !errorMetadataCache.get(code));

    // 4. Enrich data in parallel from PostgreSQL
    const startPg = performance.now();
    const [deviceRes, errorRes] = await Promise.all([
      this.deviceRepo.getDevicesByIds(missingDeviceIds),
      this.errorRepo.getErrorsByCodes(missingErrorCodes),
    ]);
    const pgDuration = Math.round(performance.now() - startPg);
    metrics.postgres_query_time_ms += pgDuration;
    metrics.metadata_ids_fetched =
      (metrics.metadata_ids_fetched ?? 0) + missingDeviceIds.length + missingErrorCodes.length;

    for (const device of deviceRes.devices) {
      deviceMetadataCache.set(device.device_id, device);
    }
    for (const error of errorRes.errors) {
      errorMetadataCache.set(error.error_code, error);
    }

    const deviceMap = resultDeviceIds.reduce<Record<string, DeviceMetadata>>((acc, id) => {
      const cached = deviceMetadataCache.get(id);
      if (cached) acc[id.toLowerCase()] = cached;
      return acc;
    }, {});

    const errorMap = resultErrorCodes.reduce<Record<string, ErrorMetadata>>((acc, code) => {
      const cached = errorMetadataCache.get(code);
      if (cached) acc[code.toLowerCase()] = cached;
      return acc;
    }, {});

    const enrichedAlarms = alarms.map((alarm) => ({
      alarm_id: alarm.alarm_id,
      error_code: alarm.error_code,
      error_details: errorMap[alarm.error_code.toLowerCase()] || null,
      device_id: alarm.device_id,
      device_details: deviceMap[alarm.device_id.toLowerCase()] || null,
      time_created: alarm.time_created,
      time_solved: alarm.time_solved,
      status: alarm.status,
      severity: alarm.severity,
      raw_log: alarm.raw_log,
      description: alarm.description,
    }));

    return { alarms: enrichedAlarms, total };
  }
}
