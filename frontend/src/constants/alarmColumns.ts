import type { ExportColumn } from '../services/generated/nettrace-api';

export const ALARM_COLUMN_OPTIONS: Array<{ value: ExportColumn; label: string }> = [
  { value: 'alarm_id', label: 'Alarm ID' },
  { value: 'time_created', label: 'Time created' },
  { value: 'time_solved', label: 'Time solved' },
  { value: 'status', label: 'Status' },
  { value: 'severity', label: 'Severity' },
  { value: 'error_code', label: 'Error code' },
  { value: 'error_name', label: 'Error name' },
  { value: 'error_domain', label: 'Error domain' },
  { value: 'error_description', label: 'Error description' },
  { value: 'error_default_severity', label: 'Error default severity' },
  { value: 'device_id', label: 'Device ID' },
  { value: 'device_name', label: 'Device name' },
  { value: 'device_type', label: 'Device type' },
  { value: 'vendor_id', label: 'Vendor ID' },
  { value: 'vendor_name', label: 'Vendor name' },
  { value: 'vendor_country', label: 'Vendor country' },
  { value: 'station_id', label: 'Station ID' },
  { value: 'station_name', label: 'Station name' },
  { value: 'station_province', label: 'Province' },
  { value: 'ip_address', label: 'IP address' },
  { value: 'longitude', label: 'Longitude' },
  { value: 'latitude', label: 'Latitude' },
  { value: 'raw_log', label: 'Raw log' },
  { value: 'description', label: 'Alarm description' },
];

export const DEFAULT_TABLE_COLUMNS: ExportColumn[] = [
  'time_created',
  'error_name',
  'status',
  'severity',
  'device_name',
  'description',
];

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'alarm_id',
  'time_created',
  'severity',
  'status',
  'device_id',
  'error_code',
  'description',
];

export const alarmColumnLabels = Object.fromEntries(
  ALARM_COLUMN_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ExportColumn, string>;
