import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate } from './shared.js';

export interface TopNParams {
  from_time: Date;
  to_time: Date;
  by: 'device' | 'error_code';
  n: number;
}

export class TopNAnalyticsRepository {
  async getTopN(
    params: TopNParams,
  ): Promise<{ rows: { entity_id: string; alarm_count: number }[]; durationMs: number }> {
    const { from_time, to_time, by, n } = params;

    const fromStr = formatDate(from_time);
    const toStr = formatDate(to_time);

    const queryParams: Record<string, unknown> = {
      from_time: fromStr,
      to_time: toStr,
      limit: n,
    };

    const dimColumn = by === 'device' ? 'device_id' : 'error_code';

    const query = `
      SELECT 
        ${dimColumn} as entity_id,
        count() as alarm_count
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      GROUP BY entity_id
      ORDER BY alarm_count DESC
      LIMIT {limit: UInt32}
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      entity_id: string;
      alarm_count: string;
    }>(query, queryParams);

    const formattedRows = rows.map((r) => ({
      entity_id: r.entity_id,
      alarm_count: parseInt(r.alarm_count, 10),
    }));

    return { rows: formattedRows, durationMs };
  }
}
