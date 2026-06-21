import { executeClickhouseQuery } from '../database/clickhouse/connection.js';
import { formatDate, buildClickhouseFilters } from './shared.js';

export interface SummaryParams {
  from_time: Date;
  to_time: Date;
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
}

export interface SummaryResult {
  totalAlarms: number;
  activeAlarms: number;
  closedAlarms: number;
  criticalAlarms: number;
  affectedDevices: number;
}

export class SummaryRepository {
  async getSummary(params: SummaryParams): Promise<{ summary: SummaryResult; durationMs: number }> {
    const { from_time, to_time } = params;

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

    const query = `
      SELECT
        count() as total_alarms,
        countIf(lower(status) = 'active') as active_alarms,
        countIf(lower(status) = 'closed' OR lower(status) = 'solved') as closed_alarms,
        countIf(lower(severity) = 'critical') as critical_alarms,
        uniqExact(device_id) as affected_devices
      FROM alarms
      ${prewhereClause}
    `;

    const { rows, durationMs } = await executeClickhouseQuery<{
      total_alarms: string;
      active_alarms: string;
      closed_alarms: string;
      critical_alarms: string;
      affected_devices: string;
    }>(query, queryParams);

    const summary: SummaryResult = {
      totalAlarms: 0,
      activeAlarms: 0,
      closedAlarms: 0,
      criticalAlarms: 0,
      affectedDevices: 0,
    };

    if (rows.length > 0) {
      const row = rows[0];
      summary.totalAlarms = parseInt(row.total_alarms, 10);
      summary.activeAlarms = parseInt(row.active_alarms, 10);
      summary.closedAlarms = parseInt(row.closed_alarms, 10);
      summary.criticalAlarms = parseInt(row.critical_alarms, 10);
      summary.affectedDevices = parseInt(row.affected_devices, 10);
    }

    return { summary, durationMs };
  }
}
