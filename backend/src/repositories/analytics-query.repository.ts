import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface AnalyticsQueryParams {
  metric: 'count' | 'avg_duration' | 'max_duration' | 'affected_devices';
  group_by: string[];
  time_bucket?: 'hour' | 'day' | 'week' | 'month' | 'year' | null;
  filters: {
    from_time: Date;
    to_time: Date;
    severity?: string[];
    status?: string[];
    device_id?: string[];
    error_code?: string[];
  };
  limit: number;
}

export class AnalyticsQueryRepository {
  async executeQuery(params: AnalyticsQueryParams): Promise<{
    rows: Record<string, unknown>[];
    durationMs: number;
  }> {
    const { metric, group_by, time_bucket, filters, limit } = params;

    const fromStr = formatDate(filters.from_time);
    const toStr = formatDate(filters.to_time);

    const { conditions, queryParams } = buildClickhouseFilters({
      severity: filters.severity,
      status: filters.status,
      device_id: filters.device_id,
      error_code: filters.error_code,
    });

    queryParams.from_time = fromStr;
    queryParams.to_time = toStr;
    queryParams.limit = limit;

    // 1. Metric mapping
    let metricExpr = 'count() as value';
    if (metric === 'avg_duration') {
      metricExpr = 'avg(if(isNull(time_solved), now(), time_solved) - time_created) as value';
    } else if (metric === 'max_duration') {
      metricExpr = 'max(if(isNull(time_solved), now(), time_solved) - time_created) as value';
    } else if (metric === 'affected_devices') {
      metricExpr = 'uniqExact(device_id) as value';
    }

    // 2. Select & Group By Columns
    const selectFields: string[] = [];
    const groupByFields: string[] = [];

    // Time bucketing
    if (time_bucket) {
      const bucketFunctionMap = {
        hour: 'toStartOfHour',
        day: 'toStartOfDay',
        week: 'toStartOfWeek',
        month: 'toStartOfMonth',
        year: 'toStartOfYear',
      };
      const bucketFn = bucketFunctionMap[time_bucket] || 'toStartOfDay';
      selectFields.push(`${bucketFn}(time_created) as time_bucket`);
      groupByFields.push('time_bucket');
    }

    // Native ClickHouse dimensions mapping
    const clickhouseNativeMap: Record<string, string> = {
      severity: 'severity',
      status: 'status',
      error_code: 'error_code',
      device: 'device_id',
    };

    let needsDeviceFederation = false;

    for (const field of group_by) {
      const mapped = clickhouseNativeMap[field];
      if (mapped) {
        selectFields.push(`${mapped} as ${field}`);
        groupByFields.push(mapped);
      } else {
        // Postgres-only federated fields (device_type, vendor, station, province)
        needsDeviceFederation = true;
      }
    }

    // If we need device details for postgres aggregation, select device_id
    if (needsDeviceFederation && !groupByFields.includes('device_id')) {
      selectFields.push('device_id');
      groupByFields.push('device_id');
    }

    selectFields.push(metricExpr);

    const selectClause = selectFields.join(', ');
    const groupByClause = groupByFields.length > 0 ? `GROUP BY ${groupByFields.join(', ')}` : '';
    const orderByClause = groupByFields.length > 0 ? `ORDER BY value DESC` : '';

    const prewhereConditions = [
      'time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}',
    ];
    if (conditions.length > 0) {
      prewhereConditions.push(...conditions);
    }
    const prewhereClause = `PREWHERE ${prewhereConditions.join(' AND ')}`;

    const query = `
      SELECT ${selectClause}
      FROM alarm
      ${prewhereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT {limit: UInt32}
    `;

    const { rows, durationMs } = await executeClickhouseQuery<Record<string, unknown>>(
      query,
      queryParams,
    );

    // Format metrics values
    const formattedRows = rows.map((row) => {
      const value = row.value !== undefined ? Number(row.value) : 0;
      return {
        ...row,
        value:
          metric === 'count' || metric === 'affected_devices'
            ? Math.round(value)
            : Math.round(value * 100) / 100,
      };
    });

    return { rows: formattedRows, durationMs };
  }
}
