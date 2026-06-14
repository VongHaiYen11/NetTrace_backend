import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate } from './shared.js';

export interface RatioParams {
  from_time: Date;
  to_time: Date;
}

export class RatioAnalyticsRepository {
  async getRatioBySeverity(
    params: RatioParams,
  ): Promise<{ rows: { severity: string; count: number }[]; durationMs: number }> {
    const fromStr = formatDate(params.from_time);
    const toStr = formatDate(params.to_time);

    const queryParams = { from_time: fromStr, to_time: toStr };

    const query = `
      SELECT 
        severity,
        count() as count
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      GROUP BY severity
      ORDER BY count DESC
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      severity: string;
      count: string;
    }>(query, queryParams);

    const formattedRows = rows.map((r) => ({
      severity: r.severity,
      count: parseInt(r.count, 10),
    }));

    return { rows: formattedRows, durationMs };
  }

  async getRatioByDevice(
    params: RatioParams,
  ): Promise<{ rows: { device_id: string; count: number }[]; durationMs: number }> {
    const fromStr = formatDate(params.from_time);
    const toStr = formatDate(params.to_time);

    const queryParams = { from_time: fromStr, to_time: toStr };

    const query = `
      SELECT 
        device_id,
        count() as count
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      GROUP BY device_id
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      device_id: string;
      count: string;
    }>(query, queryParams);

    const formattedRows = rows.map((r) => ({
      device_id: r.device_id,
      count: parseInt(r.count, 10),
    }));

    return { rows: formattedRows, durationMs };
  }
}
