import type { ExportColumn } from '../services/generated/nettrace-api';

const exportColumnMap: Record<ExportColumn, string> = {
  alarm_id: 'a',
  time_created: 'b',
  time_solved: 'c',
  status: 'd',
  severity: 'e',
  error_code: 'f',
  error_name: 'g',
  error_domain: 'h',
  device_id: 'i',
  device_name: 'j',
  device_type: 'k',
  station_name: 'l',
  station_province: 'm',
  vendor_name: 'n',
  raw_log: 'o',
  description: 'p',
  error_description: 'q',
  error_default_severity: 'r',
  vendor_id: 's',
  station_id: 't',
  vendor_country: 'u',
  ip_address: 'v',
  longitude: 'w',
  latitude: 'x',
};

const reverseExportColumnMap = Object.fromEntries(
  Object.entries(exportColumnMap).map(([k, v]) => [v, k])
) as Record<string, ExportColumn>;

export function encodeTableColumns(columns: ExportColumn[] | string[] | undefined): string | null {
  if (!columns) return null;
  return columns.map((col) => exportColumnMap[col as ExportColumn] || col).join(',');
}

export function decodeTableColumns(encoded: string | null | undefined): ExportColumn[] | undefined {
  if (!encoded) return undefined;
  const cols = encoded.split(',').map((code) => reverseExportColumnMap[code.trim()] || code.trim()) as ExportColumn[];
  return cols.length > 0 ? cols : undefined;
}
