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
  raw_log?: string;
  description?: string;
}

export interface QueryAlarmsParams {
  from_time: Date;
  to_time: Date;
  offset: number;
  limit: number;
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
  sort_by: 'timestamp' | 'severity' | 'status';
  sort_order: 'asc' | 'desc';
  include_total?: boolean;
  detail_level?: 'compact' | 'full';
  search?: string;
  search_field?:
    | 'alarm_id'
    | 'device_id'
    | 'device_name'
    | 'device_type'
    | 'error_code'
    | 'error_name'
    | 'severity'
    | 'status'
    | 'description'
    | 'raw_log';
}

export class QueryAlarmsRepository {
  async queryAlarms(
    params: QueryAlarmsParams,
  ): Promise<{ alarms: AlarmRecord[]; total?: number; durationMs: number }> {
    const {
      from_time,
      to_time,
      offset,
      limit,
      sort_by,
      sort_order,
      include_total = true,
      detail_level = 'full',
    } = params;

    const fromStr = formatDate(from_time);
    const toStr = formatDate(to_time);

    const { conditions: filterConditions, queryParams } = buildClickhouseFilters({
      severity: params.severity,
      status: params.status,
      device_id: params.device_id,
      error_code: params.error_code,
    });

    queryParams.from_time = fromStr;
    queryParams.to_time = toStr;
    queryParams.limit = limit;
    queryParams.offset = offset;

    const whereConditions: string[] = [];
    if (params.search && params.search_field) {
      const searchFieldMap: Partial<Record<NonNullable<QueryAlarmsParams['search_field']>, string>> = {
        alarm_id: 'alarm_id',
        device_id: 'device_id',
        error_code: 'error_code',
        severity: 'severity',
        status: 'status',
        description: 'description',
        raw_log: 'raw_log',
      };
      const searchColumn = searchFieldMap[params.search_field];
      if (searchColumn) {
        whereConditions.push(`positionCaseInsensitive(${searchColumn}, {search: String}) > 0`);
        queryParams.search = params.search;
      }
    }

    const prewhereConditions = [
      'time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}',
    ];
    if (filterConditions.length > 0) {
      prewhereConditions.push(...filterConditions);
    }
    const prewhereClause = `PREWHERE ${prewhereConditions.join(' AND ')}`;
    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sortFieldMap: Record<string, string> = {
      timestamp: 'time_created',
      severity: 'severity',
      status: 'status',
    };
    const orderColumn = sortFieldMap[sort_by] || 'time_created';
    const orderDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    const selectColumns =
      detail_level === 'compact'
        ? `
        alarm_id,
        error_code,
        device_id,
        time_created,
        time_solved,
        status,
        severity
      `
        : `
        alarm_id,
        error_code,
        device_id,
        time_created,
        time_solved,
        status,
        severity,
        raw_log,
        description
      `;

    const dataQuery = `
      SELECT 
        ${selectColumns}
      FROM alarm
      ${prewhereClause}
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}, alarm_id ${orderDirection}
      LIMIT {limit: UInt32} OFFSET {offset: UInt32}
    `;

    const countQuery = `
      SELECT count() as total
      FROM alarm
      ${prewhereClause}
      ${whereClause}
    `;

    const dataPromise = executeClickhouseQuery<AlarmRecord>(dataQuery, queryParams);
    const countPromise = include_total
      ? executeClickhouseQuery<{ total: string }>(countQuery, queryParams)
      : Promise.resolve(null);

    const [dataResult, countResult] = await Promise.all([dataPromise, countPromise]);

    const total = countResult?.rows.length ? parseInt(countResult.rows[0].total, 10) : undefined;
    const totalDuration = dataResult.durationMs + (countResult?.durationMs ?? 0);

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

    const prewhereConditions = [
      'time_created BETWEEN {from_time: DateTime} AND {to_time: DateTime}',
    ];
    if (conditions.length > 0) {
      prewhereConditions.push(...conditions);
    }
    const prewhereClause = `PREWHERE ${prewhereConditions.join(' AND ')}`;

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
      FROM alarm
      ${prewhereClause}
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
