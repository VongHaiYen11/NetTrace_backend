import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface TimeSeriesCountParams {
  from_time: Date;
  to_time: Date;
  interval: 'hour' | 'day';
  severity?: string;
  status?: string;
  device_id?: string;
}

export class TimeSeriesCountRepository {
  async getTimeSeriesCount(params: TimeSeriesCountParams): Promise<{
    rows: { bucket: string; total_alarms: number; active_alarms: number }[];
    durationMs: number;
  }> {
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

    const bucketFn = interval === 'hour' ? 'toStartOfHour' : 'toStartOfDay';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        ${bucketFn}(time_created) as bucket,
        count() as total_alarms,
        countIf(status = 'ACTIVE' OR status = 'active') as active_alarms
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      bucket: string;
      total_alarms: string;
      active_alarms: string;
    }>(query, queryParams);

    const formattedRows = rows.map((r) => ({
      bucket: r.bucket,
      total_alarms: parseInt(r.total_alarms, 10),
      active_alarms: parseInt(r.active_alarms, 10),
    }));

    return { rows: formattedRows, durationMs };
  }
}
