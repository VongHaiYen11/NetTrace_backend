import { Response } from 'express';
import { Transform } from 'stream';
import ExcelJS from 'exceljs';
import { QueryAlarmsRepository } from '../repositories/query-alarms.repository.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { ErrorRepository } from '../repositories/error.repository.js';
import { ServiceMetrics } from './shared.js';

interface ColumnDef {
  key: string;
  header: string;
  width: number;
  getValue: (row: any, dev: any, err: any) => any;
}

const COLUMN_DEFS: Record<string, ColumnDef> = {
  alarm_id: { key: 'alarm_id', header: 'Alarm ID', width: 40, getValue: (r) => r.alarm_id },
  time_created: { key: 'time_created', header: 'Time Created', width: 25, getValue: (r) => r.time_created },
  time_solved: { key: 'time_solved', header: 'Time Solved', width: 25, getValue: (r) => r.time_solved || 'N/A' },
  status: { key: 'status', header: 'Status', width: 12, getValue: (r) => r.status },
  severity: { key: 'severity', header: 'Severity', width: 12, getValue: (r) => r.severity },
  error_code: { key: 'error_code', header: 'Error Code', width: 15, getValue: (r) => r.error_code },
  error_name: { key: 'error_name', header: 'Error Name', width: 20, getValue: (r, d, e) => e.name || 'Unknown' },
  error_domain: { key: 'error_domain', header: 'Error Domain', width: 15, getValue: (r, d, e) => e.domain || 'N/A' },
  device_id: { key: 'device_id', header: 'Device ID', width: 15, getValue: (r) => r.device_id },
  device_name: { key: 'device_name', header: 'Device Name', width: 20, getValue: (r, d) => d.name || 'Unknown' },
  device_type: { key: 'device_type', header: 'Device Type', width: 15, getValue: (r, d) => d.device_type || 'N/A' },
  station_name: { key: 'station_name', header: 'Station Name', width: 20, getValue: (r, d) => d.station_name || 'N/A' },
  station_province: { key: 'station_province', header: 'Station Province', width: 15, getValue: (r, d) => d.station_province || 'N/A' },
  vendor_name: { key: 'vendor_name', header: 'Vendor Name', width: 15, getValue: (r, d) => d.vendor_name || 'N/A' },
  raw_log: { key: 'raw_log', header: 'Raw Log', width: 40, getValue: (r) => r.raw_log },
  description: { key: 'description', header: 'Description', width: 40, getValue: (r) => r.description },
};

export class ExportService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) {}

  async exportAlarms(
    params: {
      format: 'csv' | 'xlsx';
      columns?: string[];
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
        sort_by?: 'timestamp' | 'severity' | 'status';
        sort_order?: 'asc' | 'desc';
        limit?: number;
      };
    },
    res: Response,
    metrics: ServiceMetrics,
  ) {
    const { format, filters, columns } = params;
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
        this.writeEmptyResponse(res, format, columns);
        return;
      }

      if (filters.device_id && filters.device_id.length > 0) {
        const set = new Set(deviceIds);
        finalDeviceIds = filters.device_id.filter((id) => set.has(id));
        if (finalDeviceIds.length === 0) {
          this.writeEmptyResponse(res, format, columns);
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
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
      limit: filters.limit,
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

    // Resolve active columns to export
    const selectedKeys = columns && columns.length > 0 ? columns : Object.keys(COLUMN_DEFS);
    const activeCols = selectedKeys.map((key) => COLUMN_DEFS[key]).filter(Boolean);

    // Set Response Headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.csv"');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.xlsx"');
    }

    let recordsCount = 0;
    const escapeCsvRef = this.escapeCsv.bind(this);

    if (format === 'csv') {
      res.write('\ufeff');
      res.write(activeCols.map((col) => escapeCsvRef(col.header)).join(',') + '\n');

      const csvTransform = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          try {
            const line = chunk.toString().trim();
            if (!line) return callback();

            const lines = line.split('\n');
            let output = '';
            for (const item of lines) {
              if (!item.trim()) continue;
              const row = JSON.parse(item);
              recordsCount++;

              const dev = deviceMap[row.device_id] || {};
              const err = errorMap[row.error_code] || {};

              const values = activeCols.map((col) => col.getValue(row, dev, err));

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

      worksheet.columns = activeCols.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }));

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

              const rowData: Record<string, any> = {};
              for (const col of activeCols) {
                rowData[col.key] = col.getValue(row, dev, err);
              }

              worksheet.addRow(rowData).commit();
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

  private writeEmptyResponse(res: Response, format: 'csv' | 'xlsx', columns?: string[]) {
    const selectedKeys = columns && columns.length > 0 ? columns : Object.keys(COLUMN_DEFS);
    const activeCols = selectedKeys.map((key) => COLUMN_DEFS[key]).filter(Boolean);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.csv"');
      res.write('\ufeff');
      res.write(activeCols.map((col) => this.escapeCsv(col.header)).join(',') + '\n');
      res.write('No records found matching filters.\n');
      res.end();
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.xlsx"');
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const worksheet = workbook.addWorksheet('Alarms');
      worksheet.columns = activeCols.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }));
      worksheet.addRow(['No records found matching filters.']).commit();
      workbook.commit();
    }
  }
}
