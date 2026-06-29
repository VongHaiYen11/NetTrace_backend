import {
  AnalyticsQueryRepository,
  AnalyticsQueryParams,
} from '../repositories/analytics-query.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ServiceMetrics, splitDateRangeIntoChunks } from './shared.js';
import { config } from '../configs/database.config.js';
import { TtlMapCache } from './metadata-cache.js';

const deviceMetadataCache = new TtlMapCache<DeviceMetadata>(config.performance.metadataCacheTtlMs);

export class AnalyticsQueryService {
  constructor(
    private readonly analyticsQueryRepo: AnalyticsQueryRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  async executeQuery(
    params: AnalyticsQueryParams & {
      filters: {
        device_type?: string[];
        vendor?: string[];
        station?: string[];
        province?: string[];
      };
    },
    metrics: ServiceMetrics,
  ) {
    const { filters } = params;
    const { device_type, vendor, station, province } = filters;
    let finalDeviceIds = filters.device_id;

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

      if (filters.device_id && filters.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = filters.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          return [];
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    const clickhouseParams: AnalyticsQueryParams = {
      metric: params.metric,
      group_by: params.group_by,
      time_bucket: params.time_bucket,
      filters: {
        from_time: filters.from_time,
        to_time: filters.to_time,
        severity: filters.severity,
        status: filters.status,
        device_id: finalDeviceIds,
        error_code: filters.error_code,
      },
      limit: params.limit,
    };

    // Check if we need federated Postgres columns in group_by
    const postgresGroupByFields = params.group_by.filter(
      (field) => !['severity', 'status', 'error_code', 'device'].includes(field),
    );
    const needsDeviceFederation = postgresGroupByFields.length > 0;

    // If we need device details for grouping, we must request more rows from ClickHouse
    // because grouping by device_id yields many rows, which we then compress.
    if (needsDeviceFederation) {
      clickhouseParams.limit = config.performance.federatedAnalyticsMaxRows;
      metrics.federated_fanout_limit = clickhouseParams.limit;
    }

    const chunks = splitDateRangeIntoChunks(filters.from_time, filters.to_time);
    metrics.time_range_chunks = chunks.length;
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        this.analyticsQueryRepo.executeQuery({
          ...clickhouseParams,
          filters: {
            ...clickhouseParams.filters,
            from_time: chunk.from_time,
            to_time: chunk.to_time,
          },
        }),
      ),
    );
    const rawRows = chunkResults.flatMap((result) => {
      metrics.clickhouse_query_time_ms += result.durationMs;
      metrics.clickhouse_rows_returned =
        (metrics.clickhouse_rows_returned ?? 0) + result.rows.length;
      return result.rows;
    });
    const rows = this.mergeAnalyticsRows(rawRows, params.metric);

    if (rows.length === 0) {
      metrics.records_returned += 0;
      return [];
    }

    if (!needsDeviceFederation) {
      metrics.records_returned += rows.length;
      return rows.slice(0, params.limit);
    }

    metrics.federated_fanout_rows = rows.length;
    if (rows.length >= config.performance.federatedAnalyticsMaxRows) {
      const error = new Error(
        `Federated analytics fanout reached ${config.performance.federatedAnalyticsMaxRows} rows; narrow filters or increase FEDERATED_ANALYTICS_MAX_ROWS`,
      ) as Error & { code: string; statusCode: number };
      error.code = 'FEDERATED_FANOUT_LIMIT_EXCEEDED';
      error.statusCode = 400;
      throw error;
    }

    // Perform Data Federation mapping
    const resultDeviceIds = [...new Set(rows.map((r) => r.device_id as string))];
    const missingDeviceIds = resultDeviceIds.filter((id) => id && !deviceMetadataCache.get(id));
    const startPg = performance.now();
    const { devices } = await this.deviceRepo.getDevicesByIds(missingDeviceIds);
    metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);
    metrics.metadata_ids_fetched = (metrics.metadata_ids_fetched ?? 0) + missingDeviceIds.length;

    for (const device of devices) {
      deviceMetadataCache.set(device.device_id, device);
    }

    const deviceMap = resultDeviceIds.reduce<Record<string, DeviceMetadata>>((acc, id) => {
      const cached = deviceMetadataCache.get(id);
      if (cached) acc[id.toLowerCase()] = cached;
      return acc;
    }, {});

    // Aggregate by resolved Postgres field(s) + any time_bucket / native columns
    const aggregationMap: Record<
      string,
      { value: number; count: number; max: number; keys: Record<string, unknown> }
    > = {};

    for (const row of rows) {
      const dev = row.device_id ? deviceMap[(row.device_id as string).toLowerCase()] : undefined;

      const resolvedKeys: Record<string, unknown> = {};
      if (row.time_bucket) resolvedKeys.time_bucket = row.time_bucket;
      if (row.severity) resolvedKeys.severity = row.severity;
      if (row.status) resolvedKeys.status = row.status;
      if (row.error_code) resolvedKeys.error_code = row.error_code;

      for (const field of params.group_by) {
        if (['severity', 'status', 'error_code'].includes(field)) {
          resolvedKeys[field] = row[field];
        } else if (field === 'device') {
          resolvedKeys.device = row.device_id;
        } else {
          let val = 'Unknown';
          if (dev) {
            if (field === 'device_type') val = dev.device_type || 'Unknown';
            else if (field === 'vendor') val = dev.vendor_name || 'Unknown';
            else if (field === 'station') val = dev.station_name || 'Unknown';
            else if (field === 'province') val = dev.station_province || 'Unknown';
          }
          resolvedKeys[field] = val;
        }
      }

      const groupKey = JSON.stringify(resolvedKeys);
      const valNum = Number(row.value);

      if (!aggregationMap[groupKey]) {
        aggregationMap[groupKey] = {
          value: 0,
          count: 0,
          max: -Infinity,
          keys: resolvedKeys,
        };
      }

      const agg = aggregationMap[groupKey];
      agg.count++;
      agg.value += valNum;
      if (valNum > agg.max) {
        agg.max = valNum;
      }
    }

    const result = Object.values(aggregationMap).map((agg) => {
      let finalVal = agg.value;
      if (params.metric === 'avg_duration') {
        finalVal = agg.value / agg.count;
      } else if (params.metric === 'max_duration') {
        finalVal = agg.max;
      } else if (params.metric === 'affected_devices') {
        finalVal = agg.count;
      }

      return {
        ...agg.keys,
        value:
          params.metric === 'count' || params.metric === 'affected_devices'
            ? Math.round(finalVal)
            : Math.round(finalVal * 100) / 100,
      };
    });

    result.sort((a, b) => b.value - a.value);

    const slicedResult = result.slice(0, params.limit);
    metrics.records_returned += slicedResult.length;
    return slicedResult;
  }

  private mergeAnalyticsRows(
    rows: Record<string, unknown>[],
    metric: AnalyticsQueryParams['metric'],
  ): Record<string, unknown>[] {
    const byKey = new Map<
      string,
      { keys: Record<string, unknown>; value: number; count: number; max: number }
    >();

    rows.forEach((row) => {
      const keys = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== 'value'),
      ) as Record<string, unknown>;
      const key = JSON.stringify(keys);
      const value = Number(row.value ?? 0);
      const current = byKey.get(key) ?? { keys, value: 0, count: 0, max: -Infinity };
      current.value += value;
      current.count += 1;
      current.max = Math.max(current.max, value);
      byKey.set(key, current);
    });

    return Array.from(byKey.values())
      .map((entry) => {
        let value = entry.value;
        if (metric === 'avg_duration') {
          value = entry.value / entry.count;
        } else if (metric === 'max_duration') {
          value = entry.max;
        }

        return {
          ...entry.keys,
          value:
            metric === 'count' || metric === 'affected_devices'
              ? Math.round(value)
              : Math.round(value * 100) / 100,
        };
      })
      .sort((a, b) => Number(b.value) - Number(a.value));
  }
}
