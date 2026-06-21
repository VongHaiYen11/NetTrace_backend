import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface HeatmapParams {
  from_time: Date;
  to_time: Date;
  mode: 'weekday' | 'calendar';
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
}

export class HeatmapRepository {
  async getHeatmap(params: HeatmapParams): Promise<{
    rows: Record<string, unknown>[];
    durationMs: number;
  }> {
    const { from_time, to_time, mode } = params;

    const fromStr = formatDate(from_time);
    const toStr = formatDate(to_time);

    const { conditions, queryParams } = buildClickhouseFilters({
      severity: params.severity,
      status: params.status,
      device_id: params.device_id,
      error_code: params.error_code,
    });

    queryParams.from_time = fromStr;
    queryParams.to_time = toStr;

    const prewhereConditions = [
      'time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}',
    ];
    if (conditions.length > 0) {
      prewhereConditions.push(...conditions);
    }
    const prewhereClause = `PREWHERE ${prewhereConditions.join(' AND ')}`;

    let selectClause = '';
    let groupByClause = '';

    if (mode === 'weekday') {
      selectClause =
        'toDayOfWeek(time_created) AS day_of_week, toHour(time_created) AS hour, count() AS count';
      groupByClause = 'GROUP BY day_of_week, hour';
    } else {
      selectClause = 'toDate(time_created) AS day, count() AS count';
      groupByClause = 'GROUP BY day';
    }

    const query = `
      SELECT ${selectClause}
      FROM alarm
      ${prewhereClause}
      ${groupByClause}
    `;

    const { rows, durationMs } = await executeClickhouseQuery<Record<string, unknown>>(
      query,
      queryParams,
    );

    return { rows, durationMs };
  }
}
