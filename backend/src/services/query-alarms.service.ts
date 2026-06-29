import {
  QueryAlarmsRepository,
  QueryAlarmsParams,
  AlarmRecord,
  AlarmColumn,
} from '../repositories/query-alarms.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ErrorRepository, ErrorMetadata } from '../repositories/error.repository.js';
import { ServiceMetrics, splitDateRangeIntoChunks } from './shared.js';
import { config } from '../configs/database.config.js';
import { TtlMapCache } from './metadata-cache.js';

const deviceMetadataCache = new TtlMapCache<DeviceMetadata>(config.performance.metadataCacheTtlMs);
const errorMetadataCache = new TtlMapCache<ErrorMetadata>(config.performance.metadataCacheTtlMs);

const DEFAULT_ALARM_COLUMNS: AlarmColumn[] = [
  'alarm_id',
  'error_code',
  'device_id',
  'time_created',
  'time_solved',
  'status',
  'severity',
];

const DEVICE_METADATA_COLUMNS = new Set<AlarmColumn>([
  'device_name',
  'device_type',
  'station_name',
  'station_province',
  'vendor_name',
]);

const ERROR_METADATA_COLUMNS = new Set<AlarmColumn>(['error_name', 'error_domain']);

function getRequestedColumns(columns?: AlarmColumn[]) {
  return columns && columns.length > 0 ? columns : DEFAULT_ALARM_COLUMNS;
}

function hasAnyColumn(columns: AlarmColumn[], targets: Set<AlarmColumn>) {
  return columns.some((column) => targets.has(column));
}

export class QueryAlarmsService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async queryAlarms(
    params: QueryAlarmsParams & {
      device_name?: string[];
      device_type?: string[];
      vendor?: string[];
      station?: string[];
      station_id?: string[];
      province?: string[];
    },
    metrics: ServiceMetrics,
  ) {
    const { device_name, device_type, vendor, station, station_id, province } = params;
    let finalDeviceIds = params.device_id;
    let finalErrorCodes = params.error_code;
    const requestedColumns = getRequestedColumns(params.columns);
    metrics.include_total = params.include_total ?? true;
    metrics.alarm_columns = requestedColumns;

    if (
      params.search &&
      (params.search_field === 'device_name' || params.search_field === 'device_type')
    ) {
      const startPgSearch = performance.now();
      const { deviceIds } = await this.deviceRepo.getDeviceIdsBySearch({
        field: params.search_field,
        search: params.search,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgSearch);

      if (deviceIds.length === 0) {
        return { alarms: [], total: 0 };
      }

      if (finalDeviceIds && finalDeviceIds.length > 0) {
        const set = new Set(deviceIds.map((id) => id.toLowerCase()));
        finalDeviceIds = finalDeviceIds.filter((id) => set.has(id.toLowerCase()));
        if (finalDeviceIds.length === 0) {
          return { alarms: [], total: 0 };
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    if (params.search && params.search_field === 'error_name') {
      const startPgSearch = performance.now();
      const { errorCodes } = await this.errorRepo.getErrorCodesBySearch({
        field: 'error_name',
        search: params.search,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgSearch);

      if (errorCodes.length === 0) {
        return { alarms: [], total: 0 };
      }

      if (finalErrorCodes && finalErrorCodes.length > 0) {
        const set = new Set(errorCodes.map((code) => code.toLowerCase()));
        finalErrorCodes = finalErrorCodes.filter((code) => set.has(code.toLowerCase()));
        if (finalErrorCodes.length === 0) {
          return { alarms: [], total: 0 };
        }
      } else {
        finalErrorCodes = errorCodes;
      }
    }

    // 1. Resolve PostgreSQL device filters if present
    if (
      (device_type && device_type.length > 0) ||
      (device_name && device_name.length > 0) ||
      (vendor && vendor.length > 0) ||
      (station && station.length > 0) ||
      (station_id && station_id.length > 0) ||
      (province && province.length > 0)
    ) {
      const startPgFilter = performance.now();
      const { deviceIds } = await this.deviceRepo.getDeviceIdsByFilters({
        device_name,
        device_type,
        vendor,
        station,
        station_id,
        province,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgFilter);

      if (deviceIds.length === 0) {
        // No devices match the metadata filters, so no alarms can exist
        return { alarms: [], total: 0 };
      }

      // If user also passed specific device_id filter, intersect them
      if (finalDeviceIds && finalDeviceIds.length > 0) {
        const set = new Set(deviceIds.map((id) => id.toLowerCase()));
        finalDeviceIds = finalDeviceIds.filter((id) => set.has(id.toLowerCase()));
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
      error_code: finalErrorCodes,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
      include_total: params.include_total,
      columns: params.columns,
      search:
        params.search &&
        params.search_field !== 'device_name' &&
        params.search_field !== 'device_type' &&
        params.search_field !== 'error_name'
          ? params.search
          : undefined,
      search_field:
        params.search &&
        params.search_field !== 'device_name' &&
        params.search_field !== 'device_type' &&
        params.search_field !== 'error_name'
          ? params.search_field
          : undefined,
    };

    const chunks = splitDateRangeIntoChunks(params.from_time, params.to_time);
    metrics.time_range_chunks = chunks.length;
    const requestedOffset = params.offset ?? 0;
    const requestedLimit = params.limit ?? 100;
    const chunkLimit = requestedOffset + requestedLimit;
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        this.queryAlarmsRepo.queryAlarms({
          ...clickhouseParams,
          from_time: chunk.from_time,
          to_time: chunk.to_time,
          offset: 0,
          limit: chunkLimit,
        }),
      ),
    );

    let total: number | undefined;
    const alarms = chunkResults.flatMap((result) => {
      metrics.clickhouse_query_time_ms += result.durationMs;
      metrics.clickhouse_rows_returned =
        (metrics.clickhouse_rows_returned ?? 0) + result.alarms.length;
      if (result.total !== undefined) {
        total = (total ?? 0) + result.total;
      }
      return result.alarms;
    });

    alarms.sort((a, b) => this.compareAlarms(a, b, params.sort_by, params.sort_order));
    const pagedAlarms = alarms.slice(requestedOffset, requestedOffset + requestedLimit);
    metrics.records_returned += pagedAlarms.length;

    if (pagedAlarms.length === 0) {
      return { alarms: [], total };
    }

    // 3. Extract unique IDs from alarms result set
    const shouldEnrichDevices = hasAnyColumn(requestedColumns, DEVICE_METADATA_COLUMNS);
    const shouldEnrichErrors = hasAnyColumn(requestedColumns, ERROR_METADATA_COLUMNS);
    const resultDeviceIds = shouldEnrichDevices
      ? [...new Set(pagedAlarms.map((a) => a.device_id).filter(Boolean))]
      : [];
    const resultErrorCodes = shouldEnrichErrors
      ? [...new Set(pagedAlarms.map((a) => a.error_code).filter(Boolean))]
      : [];
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

    const enrichedAlarms = pagedAlarms.map((alarm) => ({
      alarm_id: alarm.alarm_id,
      error_code: alarm.error_code,
      error_details: alarm.error_code ? errorMap[alarm.error_code.toLowerCase()] || null : null,
      device_id: alarm.device_id,
      device_details: alarm.device_id ? deviceMap[alarm.device_id.toLowerCase()] || null : null,
      time_created: alarm.time_created,
      time_solved: alarm.time_solved,
      status: alarm.status,
      severity: alarm.severity,
      raw_log: alarm.raw_log,
      description: alarm.description,
    }));

    return { alarms: enrichedAlarms, total };
  }

  private compareAlarms(
    a: AlarmRecord,
    b: AlarmRecord,
    sortBy: QueryAlarmsParams['sort_by'],
    sortOrder: QueryAlarmsParams['sort_order'],
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    const getValue = (record: typeof a) => {
      if (sortBy === 'severity') return record.severity;
      if (sortBy === 'status') return record.status;
      return record.time_created;
    };

    const left = getValue(a);
    const right = getValue(b);
    const primary = String(left).localeCompare(String(right));
    if (primary !== 0) return primary * direction;
    return String(a.alarm_id).localeCompare(String(b.alarm_id)) * direction;
  }
}
