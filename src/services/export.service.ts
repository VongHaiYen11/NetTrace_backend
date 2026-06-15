import { Response } from 'express';
import { Transform } from 'stream';
import ExcelJS from 'exceljs';
import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ErrorRepository } from '../repositories/error.repository.js';
import { ServiceMetrics } from './shared.js';

export class ExportService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async exportAlarms(
    params: {
      format: 'csv' | 'xlsx';
      filters: {
        from_time: Date;
        to_time: Date;
        severity?: string[];
        status?: string[];
        device_id?: string[];
        error_code?: string[];
        device_type?: string[];
        vendor?: string[];
        station?: string[];
        province?: string[];
      };
    },
    res: Response,
    metrics: ServiceMetrics,
  ) {
    const { format, filters } = params;
    const { device_type, vendor, station, province } = filters;
    let finalDeviceIds = filters.device_id;

    // 1. Resolve PostgreSQL device filters if present
    if (
      (device_type && device_type.length > 0) ||
      (vendor && vendor.length > 0) ||
      (station && station.length > 0) ||
      (province && province.length > 0)
    ) {
      const startPgFilter = performance.now();
      const { deviceIds, durationMs } = await this.deviceRepo.getDeviceIdsByFilters({
        device_type,
        vendor,
        station,
        province,
      });
      metrics.postgres_query_time_ms += Math.round(performance.now() - startPgFilter);

      if (deviceIds.length === 0) {
        this.writeEmptyResponse(res, format);
        return;
      }

      if (filters.device_id && filters.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = filters.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          this.writeEmptyResponse(res, format);
          return;
        }
      } else {
        finalDeviceIds = deviceIds;
      }
    }

    // 2. Fetch ClickHouse stream
    const clickhouseStream = await this.queryAlarmsRepo.queryAlarmsStream({
      from_time: filters.from_time,
      to_time: filters.to_time,
      severity: filters.severity,
      status: filters.status,
      device_id: finalDeviceIds,
      error_code: filters.error_code,
    });

    // 3. Pre-load PostgreSQL metadata for streaming mapping
    const startPgMeta = performance.now();
    const [devicesRes, errorsRes] = await Promise.all([
      this.deviceRepo.getAllDevices(),
      this.errorRepo.getAllErrors(),
    ]);
    metrics.postgres_query_time_ms += Math.round(performance.now() - startPgMeta);

    const deviceMap = devicesRes.devices.reduce<Record<string, any>>((acc, d) => {
      acc[d.device_id] = d;
      return acc;
    }, {});

    const errorMap = errorsRes.errors.reduce<Record<string, any>>((acc, e) => {
      acc[e.error_code] = e;
      return acc;
    }, {});

    // Set Response Headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.csv"');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.xlsx"');
    }

    let recordsCount = 0;

    if (format === 'csv') {
      res.write('\ufeff');
      
      const csvHeaders = [
        'Alarm ID',
        'Time Created',
        'Time Solved',
        'Status',
        'Severity',
        'Error Code',
        'Error Name',
        'Error Domain',
        'Device ID',
        'Device Name',
        'Device Type',
        'Station Name',
        'Station Province',
        'Vendor Name',
        'Raw Log',
        'Description',
      ];
      res.write(csvHeaders.map(this.escapeCsv).join(',') + '\n');

      const csvTransform = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          try {
            const line = chunk.toString().trim();
            if (!line) return callback();

            // Handle potential multiple JSON objects separated by newlines within the chunk
            const lines = line.split('\n');
            let output = '';
            for (const item of lines) {
              if (!item.trim()) continue;
              const row = JSON.parse(item);
              recordsCount++;

              const dev = deviceMap[row.device_id] || {};
              const err = errorMap[row.error_code] || {};

              const values = [
                row.alarm_id,
                row.time_created,
                row.time_solved || 'N/A',
                row.status,
                row.severity,
                row.error_code,
                err.name || 'Unknown',
                err.domain || 'N/A',
                row.device_id,
                dev.name || 'Unknown',
                dev.device_type || 'N/A',
                dev.station_name || 'N/A',
                dev.station_province || 'N/A',
                dev.vendor_name || 'N/A',
                row.raw_log,
                row.description,
              ];

              output += values.map((v) => {
                if (v === null || v === undefined) return '';
                const str = String(v);
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              }).join(',') + '\n';
            }

            callback(null, output);
          } catch (e: any) {
            callback(e);
          }
        },
      });

      clickhouseStream.pipe(csvTransform).pipe(res);

      await new Promise<void>((resolve, reject) => {
        res.on('finish', () => {
          metrics.records_returned += recordsCount;
          resolve();
        });
        clickhouseStream.on('error', reject);
        csvTransform.on('error', reject);
      });

    } else {
      const options = {
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      };

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
      const worksheet = workbook.addWorksheet('Alarms');

      worksheet.columns = [
        { header: 'Alarm ID', key: 'alarm_id', width: 40 },
        { header: 'Time Created', key: 'time_created', width: 25 },
        { header: 'Time Solved', key: 'time_solved', width: 25 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Severity', key: 'severity', width: 12 },
        { header: 'Error Code', key: 'error_code', width: 15 },
        { header: 'Error Name', key: 'error_name', width: 20 },
        { header: 'Error Domain', key: 'error_domain', width: 15 },
        { header: 'Device ID', key: 'device_id', width: 15 },
        { header: 'Device Name', key: 'device_name', width: 20 },
        { header: 'Device Type', key: 'device_type', width: 15 },
        { header: 'Station Name', key: 'station_name', width: 20 },
        { header: 'Station Province', key: 'station_province', width: 15 },
        { header: 'Vendor Name', key: 'vendor_name', width: 15 },
        { header: 'Raw Log', key: 'raw_log', width: 40 },
        { header: 'Description', key: 'description', width: 40 },
      ];

      await new Promise<void>((resolve, reject) => {
        clickhouseStream.on('data', (chunk) => {
          try {
            const line = chunk.toString().trim();
            if (!line) return;

            const lines = line.split('\n');
            for (const item of lines) {
              if (!item.trim()) continue;
              const row = JSON.parse(item);
              recordsCount++;

              const dev = deviceMap[row.device_id] || {};
              const err = errorMap[row.error_code] || {};

              worksheet.addRow({
                alarm_id: row.alarm_id,
                time_created: row.time_created,
                time_solved: row.time_solved || 'N/A',
                status: row.status,
                severity: row.severity,
                error_code: row.error_code,
                error_name: err.name || 'Unknown',
                error_domain: err.domain || 'N/A',
                device_id: row.device_id,
                device_name: dev.name || 'Unknown',
                device_type: dev.device_type || 'N/A',
                station_name: dev.station_name || 'N/A',
                station_province: dev.station_province || 'N/A',
                vendor_name: dev.vendor_name || 'N/A',
                raw_log: row.raw_log,
                description: row.description,
              }).commit();
            }
          } catch (e) {
            reject(e);
          }
        });

        clickhouseStream.on('end', () => {
          resolve();
        });

        clickhouseStream.on('error', (err) => {
          reject(err);
        });
      });

      await workbook.commit();
      metrics.records_returned += recordsCount;
    }
  }

  private escapeCsv(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private writeEmptyResponse(res: Response, format: 'csv' | 'xlsx') {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.csv"');
      res.write('\ufeff');
      res.write('No records found matching filters.\n');
      res.end();
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.xlsx"');
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const worksheet = workbook.addWorksheet('Alarms');
      worksheet.addRow(['No records found matching filters.']).commit();
      workbook.commit();
    }
  }
}
