import { Response } from 'express';
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

type ExportFormat = 'csv' | 'xlsx' | 'json';

const COLUMN_DEFS: Record<string, ColumnDef> = {
  alarm_id: { key: 'alarm_id', header: 'Alarm ID', width: 40, getValue: (r) => r.alarm_id },
  time_created: {
    key: 'time_created',
    header: 'Time Created',
    width: 25,
    getValue: (r) => r.time_created,
  },
  time_solved: {
    key: 'time_solved',
    header: 'Time Solved',
    width: 25,
    getValue: (r) => r.time_solved || 'N/A',
  },
  status: { key: 'status', header: 'Status', width: 12, getValue: (r) => r.status },
  severity: { key: 'severity', header: 'Severity', width: 12, getValue: (r) => r.severity },
  error_code: { key: 'error_code', header: 'Error Code', width: 15, getValue: (r) => r.error_code },
  error_name: {
    key: 'error_name',
    header: 'Error Name',
    width: 20,
    getValue: (r, d, e) => e.name || 'Unknown',
  },
  error_domain: {
    key: 'error_domain',
    header: 'Error Domain',
    width: 15,
    getValue: (r, d, e) => e.domain || 'N/A',
  },
  device_id: { key: 'device_id', header: 'Device ID', width: 15, getValue: (r) => r.device_id },
  device_name: {
    key: 'device_name',
    header: 'Device Name',
    width: 20,
    getValue: (r, d) => d.name || 'Unknown',
  },
  device_type: {
    key: 'device_type',
    header: 'Device Type',
    width: 15,
    getValue: (r, d) => d.device_type || 'N/A',
  },
  station_name: {
    key: 'station_name',
    header: 'Station Name',
    width: 20,
    getValue: (r, d) => d.station_name || 'N/A',
  },
  station_province: {
    key: 'station_province',
    header: 'Station Province',
    width: 15,
    getValue: (r, d) => d.station_province || 'N/A',
  },
  vendor_name: {
    key: 'vendor_name',
    header: 'Vendor Name',
    width: 15,
    getValue: (r, d) => d.vendor_name || 'N/A',
  },
  raw_log: { key: 'raw_log', header: 'Raw Log', width: 40, getValue: (r) => r.raw_log },
  description: {
    key: 'description',
    header: 'Description',
    width: 40,
    getValue: (r) => r.description,
  },
};

export class ExportService {
  constructor(
    private readonly queryAlarmsRepo: QueryAlarmsRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly errorRepo: ErrorRepository,
  ) { }

  async exportAlarms(
    params: {
      format: ExportFormat;
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
    const selectedKeys = columns && columns.length > 0 ? columns : Object.keys(COLUMN_DEFS);
    const activeCols = selectedKeys.map((key) => COLUMN_DEFS[key]).filter(Boolean);
    const needsDeviceMetadata = activeCols.some((col) =>
      ['device_name', 'device_type', 'station_name', 'station_province', 'vendor_name'].includes(
        col.key,
      ),
    );
    const needsErrorMetadata = activeCols.some((col) =>
      ['error_name', 'error_domain'].includes(col.key),
    );

    // 1. Resolve PostgreSQL device filters if present
    if (
      (device_type && device_type.length > 0) ||
      (vendor && vendor.length > 0) ||
      (station && station.length > 0) ||
      (province && province.length > 0)
    ) {
      const startPgFilter = performance.now();
      const { deviceIds } = await this.deviceRepo.getDeviceIdsByFilters({
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
        const lowerSet = new Set(deviceIds.map((id) => id.toLowerCase()));
        finalDeviceIds = filters.device_id.filter((id) => lowerSet.has(id.toLowerCase()));
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

    const deviceMap: Record<string, any> = {};
    const errorMap: Record<string, any> = {};

    this.setExportHeaders(res, format);

    let recordsCount = 0;
    const escapeCsvRef = this.escapeCsv.bind(this);

    if (format === 'csv') {
      res.write('\ufeff');
      res.write(activeCols.map((col) => escapeCsvRef(col.header)).join(',') + '\n');

      for await (const chunk of clickhouseStream as AsyncIterable<Buffer>) {
        const rows = this.parseJsonRows(chunk);
        if (rows.length === 0) continue;
        await this.enrichBatch(rows, {
          needsDeviceMetadata,
          needsErrorMetadata,
          deviceMap,
          errorMap,
          metrics,
        });
        metrics.export_batches = (metrics.export_batches ?? 0) + 1;
        metrics.clickhouse_rows_returned = (metrics.clickhouse_rows_returned ?? 0) + rows.length;

        let output = '';
        for (const row of rows) {
          recordsCount++;
          const values = this.projectRowValues(row, activeCols, deviceMap, errorMap);
          output += values.map((v) => this.escapeCsv(v)).join(',') + '\n';
        }
        res.write(output);
      }

      metrics.records_returned += recordsCount;
      res.end();
    } else if (format === 'json') {
      res.write('[');
      let isFirstRecord = true;

      for await (const chunk of clickhouseStream as AsyncIterable<Buffer>) {
        const rows = this.parseJsonRows(chunk);
        if (rows.length === 0) continue;
        await this.enrichBatch(rows, {
          needsDeviceMetadata,
          needsErrorMetadata,
          deviceMap,
          errorMap,
          metrics,
        });
        metrics.export_batches = (metrics.export_batches ?? 0) + 1;
        metrics.clickhouse_rows_returned = (metrics.clickhouse_rows_returned ?? 0) + rows.length;

        for (const row of rows) {
          recordsCount++;
          const rowData = this.projectRowObject(row, activeCols, deviceMap, errorMap);
          res.write(`${isFirstRecord ? '' : ','}${JSON.stringify(rowData)}`);
          isFirstRecord = false;
        }
      }

      metrics.records_returned += recordsCount;
      res.write(']');
      res.end();
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

      for await (const chunk of clickhouseStream as AsyncIterable<Buffer>) {
        const rows = this.parseJsonRows(chunk);
        if (rows.length === 0) continue;
        await this.enrichBatch(rows, {
          needsDeviceMetadata,
          needsErrorMetadata,
          deviceMap,
          errorMap,
          metrics,
        });
        metrics.export_batches = (metrics.export_batches ?? 0) + 1;
        metrics.clickhouse_rows_returned = (metrics.clickhouse_rows_returned ?? 0) + rows.length;

        for (const row of rows) {
          recordsCount++;
          const rowData = this.projectRowObject(row, activeCols, deviceMap, errorMap);

          worksheet.addRow(rowData).commit();
        }
      }

      await workbook.commit();
      metrics.records_returned += recordsCount;
    }
  }

  private setExportHeaders(res: Response, format: ExportFormat) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.csv"');
      return;
    }

    if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.xlsx"');
      return;
    }



    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alarms_export.json"');
  }

  private projectRowValues(
    row: any,
    activeCols: ColumnDef[],
    deviceMap: Record<string, any>,
    errorMap: Record<string, any>,
  ) {
    const dev = (row.device_id ? deviceMap[row.device_id.toLowerCase()] : null) || {};
    const err = (row.error_code ? errorMap[row.error_code.toLowerCase()] : null) || {};
    return activeCols.map((col) => col.getValue(row, dev, err));
  }

  private projectRowObject(
    row: any,
    activeCols: ColumnDef[],
    deviceMap: Record<string, any>,
    errorMap: Record<string, any>,
  ) {
    const values = this.projectRowValues(row, activeCols, deviceMap, errorMap);
    return activeCols.reduce<Record<string, any>>((result, col, index) => {
      result[col.key] = values[index];
      return result;
    }, {});
  }

  private parseJsonRows(chunk: any): any[] {
    if (Array.isArray(chunk)) {
      return chunk.map((item) => {
        if (item && typeof item.json === 'function') {
          return item.json();
        }
        if (item && typeof item.text === 'string') {
          try {
            return JSON.parse(item.text);
          } catch {
            return item;
          }
        }
        return item;
      });
    }

    if (chunk && typeof chunk.json === 'function') {
      return [chunk.json()];
    }

    const line = (Buffer.isBuffer(chunk) || typeof chunk === 'string')
      ? chunk.toString().trim()
      : '';
    if (!line) return [];
    return line
      .split('\n')
      .filter((item) => item.trim())
      .map((item) => JSON.parse(item));
  }

  private async enrichBatch(
    rows: any[],
    context: {
      needsDeviceMetadata: boolean;
      needsErrorMetadata: boolean;
      deviceMap: Record<string, any>;
      errorMap: Record<string, any>;
      metrics: ServiceMetrics;
    },
  ) {
    const missingDeviceIds = context.needsDeviceMetadata
      ? [
        ...new Set(
          rows
            .map((row) => row.device_id)
            .filter((id): id is string => Boolean(id))
            .filter((id) => !context.deviceMap[id.toLowerCase()]),
        ),
      ]
      : [];

    const missingErrorCodes = context.needsErrorMetadata
      ? [
        ...new Set(
          rows
            .map((row) => row.error_code)
            .filter((code): code is string => Boolean(code))
            .filter((code) => !context.errorMap[code.toLowerCase()]),
        ),
      ]
      : [];

    if (missingDeviceIds.length === 0 && missingErrorCodes.length === 0) {
      return;
    }

    const startPg = performance.now();
    const [devicesRes, errorsRes] = await Promise.all([
      missingDeviceIds.length > 0
        ? this.deviceRepo.getDevicesByIds(missingDeviceIds)
        : Promise.resolve({ devices: [], durationMs: 0 }),
      missingErrorCodes.length > 0
        ? this.errorRepo.getErrorsByCodes(missingErrorCodes)
        : Promise.resolve({ errors: [], durationMs: 0 }),
    ]);
    context.metrics.postgres_query_time_ms += Math.round(performance.now() - startPg);
    context.metrics.metadata_ids_fetched =
      (context.metrics.metadata_ids_fetched ?? 0) +
      missingDeviceIds.length +
      missingErrorCodes.length;

    for (const device of devicesRes.devices) {
      context.deviceMap[device.device_id.toLowerCase()] = device;
    }
    for (const error of errorsRes.errors) {
      context.errorMap[error.error_code.toLowerCase()] = error;
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



  private writeEmptyResponse(res: Response, format: ExportFormat, columns?: string[]) {
    const selectedKeys = columns && columns.length > 0 ? columns : Object.keys(COLUMN_DEFS);
    const activeCols = selectedKeys.map((key) => COLUMN_DEFS[key]).filter(Boolean);

    this.setExportHeaders(res, format);

    if (format === 'csv') {
      res.write('\ufeff');
      res.write(activeCols.map((col) => this.escapeCsv(col.header)).join(',') + '\n');
      res.write('No records found matching filters.\n');
      res.end();
    } else if (format === 'json') {
      res.end('[]');

    } else {
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
