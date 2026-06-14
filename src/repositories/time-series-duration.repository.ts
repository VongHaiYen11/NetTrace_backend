import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface TimeSeriesDurationParams {
  from_time: Date;
  to_time: Date;
  interval: 'day' | 'month' | 'year';
  severity?: string;
  status?: string;
  device_id?: string;
}

export class TimeSeriesDurationRepository {
  async getTimeSeriesDuration(
    params: TimeSeriesDurationParams,
  ): Promise<{ rows: { bucket: string; avg_duration_seconds: number }[]; durationMs: number }> {
    const { from_time, to_time, interval } = params;

    const fromStr = formatDate(from_time);
    const toStr = formatDate(to_time);

    const { conditions, queryParams } = buildClickhouseFilters({
      severity: params.severity,
      status: params.status,
      device_id: params.device_id,
    });

    queryParams.from_time = fromStr;
    queryParams.to_time = toStr;

    const bucketFunctionMap = {
      day: 'toStartOfDay',
      month: 'toStartOfMonth',
      year: 'toStartOfYear',
    };
    const bucketFn = bucketFunctionMap[interval] || 'toStartOfDay';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        ${bucketFn}(time_created) as bucket,
        avg(if(isNull(time_solved), now(), time_solved) - time_created) as avg_duration_seconds
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      bucket: string;
      avg_duration_seconds: string | number;
    }>(query, queryParams);

    const formattedRows = rows.map((r) => ({
      bucket: r.bucket,
      avg_duration_seconds: Math.round(Number(r.avg_duration_seconds) * 100) / 100,
    }));

    return { rows: formattedRows, durationMs };
  }
}
