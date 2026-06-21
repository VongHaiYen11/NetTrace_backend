import type { DashboardFilterFormValues, DashboardFilters } from './types';

export function defaultFilterValues(): DashboardFilterFormValues {
  return {
    fromDate: '2026-06-01',
    toDate: '2026-06-30',
    severity: '',
    status: '',
    deviceId: '',
    errorCode: '',
    province: '',
  };
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function splitCsv(value: string) {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export function toDashboardFilters(values: DashboardFilterFormValues): DashboardFilters {
  return {
    from_time: values.fromDate || undefined,
    to_time: values.toDate || undefined,
    severity: values.severity ? [values.severity] : undefined,
    status: values.status ? [values.status] : undefined,
    device_id: splitCsv(values.deviceId),
    error_code: splitCsv(values.errorCode),
    province: splitCsv(values.province),
  };
}
