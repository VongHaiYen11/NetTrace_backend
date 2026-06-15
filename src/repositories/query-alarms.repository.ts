import { executeClickhouseQuery, clickhouseClient } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface AlarmRecord {
  alarm_id: string;
  error_code: string;
  device_id: string;
  time_created: string;
  time_solved: string | null;
  status: string;
  severity: string;
  raw_log: string;
  description: string;
}

export interface QueryAlarmsParams {
  from_time: Date;
  to_time: Date;
  cursor_time?: Date;
  cursor_id?: string;
  limit: number;
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
  sort_by: 'timestamp' | 'severity' | 'status';
  sort_order: 'asc' | 'desc';
}

export class QueryAlarmsRepository {
  async queryAlarms(
    params: QueryAlarmsParams,
  ): Promise<{ alarms: AlarmRecord[]; total: number; durationMs: number }> {
    const { from_time, to_time, cursor_time, cursor_id, limit, sort_by, sort_order } = params;

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
    queryParams.limit = limit;

    // Keyset pagination cursor constraint
    if (cursor_time && cursor_id) {
      const cursorTimeStr = formatDate(cursor_time);
      queryParams.cursor_time = cursorTimeStr;
      queryParams.cursor_id = cursor_id;

      if (sort_order === 'asc') {
        conditions.push(
          '(time_created > {cursor_time: DateTime} OR (time_created = {cursor_time: DateTime} AND alarm_id > {cursor_id: String}))',
        );
      } else {
        conditions.push(
          '(time_created < {cursor_time: DateTime} OR (time_created = {cursor_time: DateTime} AND alarm_id < {cursor_id: String}))',
        );
      }
    }

    const sortFieldMap: Record<string, string> = {
      timestamp: 'time_created',
      severity: 'severity',
      status: 'status',
    };
    const orderColumn = sortFieldMap[sort_by] || 'time_created';
    const orderDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT 
        alarm_id,
        error_code,
        device_id,
        time_created,
        time_solved,
        status,
        severity,
        raw_log,
        description
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}, alarm_id ${orderDirection}
      LIMIT {limit: UInt32}
    `;

    // Filter count query (excluding cursor constraints)
    const countConditions = [...conditions];
    if (cursor_time && cursor_id) {
      countConditions.pop();
    }
    const countWhereClause =
      countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT count() as total
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      ${countWhereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      executeClickhouseQuery<AlarmRecord>(dataQuery, queryParams),
      executeClickhouseQuery<{ total: string }>(countQuery, queryParams),
    ]);

    const total = countResult.rows.length > 0 ? parseInt(countResult.rows[0].total, 10) : 0;
    const totalDuration = dataResult.durationMs + countResult.durationMs;

    return {
      alarms: dataResult.rows,
      total,
      durationMs: totalDuration,
    };
  }

  async queryAlarmsStream(params: {
    from_time: Date;
    to_time: Date;
    severity?: string[];
    status?: string[];
    device_id?: string[];
    error_code?: string[];
    sort_by?: 'timestamp' | 'severity' | 'status';
    sort_order?: 'asc' | 'desc';
    limit?: number;
  }) {
    const { from_time, to_time, sort_by = 'timestamp', sort_order = 'desc', limit } = params;

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

    const sortFieldMap: Record<string, string> = {
      timestamp: 'time_created',
      severity: 'severity',
      status: 'status',
    };
    const orderColumn = sortFieldMap[sort_by] || 'time_created';
    const orderDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let limitClause = '';
    if (limit) {
      limitClause = `LIMIT {limit: UInt32}`;
      queryParams.limit = limit;
    }

    const query = `
      SELECT 
        alarm_id,
        error_code,
        device_id,
        time_created,
        time_solved,
        status,
        severity,
        raw_log,
        description
      FROM alarms
      PREWHERE time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}, alarm_id ${orderDirection}
      ${limitClause}
    `;

    const resultSet = await clickhouseClient.query({
      query,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    return resultSet.stream();
  }
}
