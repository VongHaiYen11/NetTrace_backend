import {
  QueryAlarmsRepository,
  QueryAlarmsParams,
} from '../repositories/query-alarms.repository.js';
import { DeviceRepository, DeviceMetadata } from '../repositories/device.repository.js';
import { ErrorRepository, ErrorMetadata } from '../repositories/error.repository.js';
import { ServiceMetrics } from './shared.js';

export class QueryAlarmsService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async queryAlarms(params: QueryAlarmsParams, metrics: ServiceMetrics) {
    const {
      alarms,
      total,
      durationMs: chDuration,
    } = await this.queryAlarmsRepo.queryAlarms(params);
    metrics.clickhouse_query_time_ms += chDuration;
    metrics.records_returned += alarms.length;

    if (alarms.length === 0) {
      return { alarms: [], total };
    }

    const deviceIds = [...new Set(alarms.map((a) => a.device_id))];
    const errorCodes = [...new Set(alarms.map((a) => a.error_code))];

    const startPg = performance.now();
    const [deviceRes, errorRes] = await Promise.all([
      this.deviceRepo.getDevicesByIds(deviceIds),
      this.errorRepo.getErrorsByCodes(errorCodes),
    ]);
    const pgDuration = Math.round(performance.now() - startPg);
    metrics.postgres_query_time_ms += pgDuration;

    const deviceMap = deviceRes.devices.reduce<Record<string, DeviceMetadata>>((acc, d) => {
      acc[d.device_id] = d;
      return acc;
    }, {});

    const errorMap = errorRes.errors.reduce<Record<string, ErrorMetadata>>((acc, e) => {
      acc[e.error_code] = e;
      return acc;
    }, {});

    const enrichedAlarms = alarms.map((alarm) => ({
      alarm_id: alarm.alarm_id,
      error_code: alarm.error_code,
      error_details: errorMap[alarm.error_code] || null,
      device_id: alarm.device_id,
      device_details: deviceMap[alarm.device_id] || null,
      time_created: alarm.time_created,
      time_solved: alarm.time_solved,
      status: alarm.status,
      severity: alarm.severity,
      raw_log: alarm.raw_log,
      description: alarm.description,
    }));

    return { alarms: enrichedAlarms, total };
  }
}
