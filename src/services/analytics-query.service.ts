import { AnalyticsQueryRepository, AnalyticsQueryParams } from '../repositories/analytics-query.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ServiceMetrics } from './shared.js';

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
      clickhouseParams.limit = 10000;
    }

    const { rows, durationMs } = await this.analyticsQueryRepo.executeQuery(clickhouseParams);
    metrics.clickhouse_query_time_ms += durationMs;

    if (rows.length === 0) {
      metrics.records_returned += 0;
      return [];
    }

    if (!needsDeviceFederation) {
      metrics.records_returned += rows.length;
      return rows.slice(0, params.limit);
    }

    // Perform Data Federation mapping
    const resultDeviceIds = [...new Set(rows.map((r) => r.device_id as string))];
    const startPg = performance.now();
    const { devices } = await this.deviceRepo.getDevicesByIds(resultDeviceIds);
    metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);

    const deviceMap = devices.reduce<Record<string, DeviceMetadata>>((acc, d) => {
      acc[d.device_id] = d;
      return acc;
    }, {});

    // Aggregate by resolved Postgres field(s) + any time_bucket / native columns
    const aggregationMap: Record<string, { value: number; count: number; max: number; keys: Record<string, unknown> }> = {};

    for (const row of rows) {
      const dev = deviceMap[row.device_id as string];
      
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
        value: params.metric === 'count' || params.metric === 'affected_devices' ? Math.round(finalVal) : Math.round(finalVal * 100) / 100,
      };
    });

    result.sort((a, b) => b.value - a.value);
    
    const slicedResult = result.slice(0, params.limit);
    metrics.records_returned += slicedResult.length;
    return slicedResult;
  }
}
