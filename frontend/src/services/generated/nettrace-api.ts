export type Severity = 'critical' | 'major' | 'minor' | 'warning' | 'info' | string;
export type AlarmStatus = 'active' | 'closed' | 'acknowledged' | string;
export type SortBy = 'timestamp' | 'severity' | 'status';
export type SortOrder = 'asc' | 'desc';
export type Metric = 'count' | 'avg_duration' | 'max_duration' | 'affected_devices';
export type GroupBy =
  | 'severity'
  | 'status'
  | 'error_code'
  | 'device'
  | 'device_type'
  | 'vendor'
  | 'station'
  | 'province';
export type TimeBucket = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
}

export interface DeviceDetails {
  device_id: string;
  name: string;
  vendor_id: string;
  vendor_name: string;
  vendor_country: string;
  station_id: string;
  station_name: string;
  station_province: string;
  device_type: string;
  ip_address: string;
  longitude: number;
  latitude: number;
  additional_info: string | null;
}

export interface ErrorDetails {
  error_code: string;
  name: string;
  description: string;
  domain: string;
  default_severity: string;
}

export interface Alarm {
  alarm_id: string;
  error_code: string;
  error_details?: ErrorDetails;
  device_id: string;
  device_details?: DeviceDetails;
  time_created: string;
  time_solved: string | null;
  status: AlarmStatus;
  severity: Severity;
  raw_log?: string;
  description?: string;
}

export interface CommonFilters {
  from_time?: string;
  to_time?: string;
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
  device_type?: string[];
  vendor?: string[];
  station?: string[];
  province?: string[];
}

export interface QueryAlarmsParams extends CommonFilters {
  offset?: number;
  limit?: number;
  sort_by?: SortBy;
  sort_order?: SortOrder;
  include_total?: boolean;
  detail_level?: 'compact' | 'full';
}

export interface SummaryResult {
  totalAlarms: number;
  activeAlarms: number;
  closedAlarms: number;
  criticalAlarms: number;
  affectedDevices: number;
}

export type AnalyticsRow = Record<string, string | number | null | undefined> & {
  value: number;
  time_bucket?: string;
};

export interface AnalyticsQueryRequest {
  metric: Metric;
  group_by: GroupBy[];
  time_bucket?: TimeBucket | null;
  filters?: CommonFilters;
  limit?: number;
}

export type HeatmapRequest = {
  mode: 'weekday';
  filters?: CommonFilters;
} | {
  mode: 'calendar';
  filters?: CommonFilters;
};

export interface WeekdayHeatmapCell {
  x: number;
  y: string;
  value: number;
}

export interface CalendarHeatmapCell {
  day: string;
  value: number;
}

export interface TemplateSummary {
  template_id: number;
  name: string;
  selected_cards: string | null;
  number_of_widgets: number;
  time_created: string;
  time_updated: string;
}

export interface TemplateWidgetInput {
  device_id: string;
  position: number;
  chart_type: string;
  status?: string | null;
  severity?: string | null;
  error_code?: string | null;
  vendor_id?: string | null;
  device_type?: string | null;
}

export interface CreateTemplateRequest {
  name: string;
  selected_cards?: string | null;
  widgets?: TemplateWidgetInput[];
}

export type ExportColumn =
  | 'alarm_id'
  | 'time_created'
  | 'time_solved'
  | 'status'
  | 'severity'
  | 'error_code'
  | 'error_name'
  | 'error_domain'
  | 'device_id'
  | 'device_name'
  | 'device_type'
  | 'station_name'
  | 'station_province'
  | 'vendor_name'
  | 'raw_log'
  | 'description';

export interface ExportRequest {
  format: 'csv' | 'xlsx';
  columns?: ExportColumn[];
  filters?: CommonFilters & {
    sort_by?: SortBy;
    sort_order?: SortOrder;
    limit?: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function appendArrayParam(params: URLSearchParams, key: string, values?: string[]) {
  if (values && values.length > 0) {
    params.set(key, values.join(','));
  }
}

function buildQuery(filters: QueryAlarmsParams | CommonFilters = {}) {
  const params = new URLSearchParams();
  if (filters.from_time) params.set('from_time', filters.from_time);
  if (filters.to_time) params.set('to_time', filters.to_time);
  appendArrayParam(params, 'severity', filters.severity);
  appendArrayParam(params, 'status', filters.status);
  appendArrayParam(params, 'device_id', filters.device_id);
  appendArrayParam(params, 'error_code', filters.error_code);
  appendArrayParam(params, 'device_type', filters.device_type);
  appendArrayParam(params, 'vendor', filters.vendor);
  appendArrayParam(params, 'station', filters.station);
  appendArrayParam(params, 'province', filters.province);

  const alarmFilters = filters as QueryAlarmsParams;
  if (alarmFilters.offset !== undefined) params.set('offset', String(alarmFilters.offset));
  if (alarmFilters.limit !== undefined) params.set('limit', String(alarmFilters.limit));
  if (alarmFilters.sort_by) params.set('sort_by', alarmFilters.sort_by);
  if (alarmFilters.sort_order) params.set('sort_order', alarmFilters.sort_order);
  if (alarmFilters.include_total !== undefined) {
    params.set('include_total', String(alarmFilters.include_total));
  }
  if (alarmFilters.detail_level) params.set('detail_level', alarmFilters.detail_level);
  return params.toString();
}

async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const payload = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;
  if (!response.ok || payload.success === false) {
    const error = payload.success === false ? payload.error : undefined;
    throw {
      status: response.status,
      code: error?.code ?? 'REQUEST_FAILED',
      message: error?.message ?? response.statusText,
    } satisfies ApiErrorShape;
  }
  return payload;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });
  return parseJsonResponse<T>(response);
}

export const nettraceApi = {
  async getSummary(filters: CommonFilters) {
    const query = buildQuery(filters);
    return requestJson<SummaryResult>(`/api/v1/analytics/summary${query ? `?${query}` : ''}`);
  },

  async queryAlarms(params: QueryAlarmsParams) {
    const query = buildQuery(params);
    return requestJson<Alarm[]>(`/api/v1/alarms${query ? `?${query}` : ''}`);
  },

  async analyticsQuery(request: AnalyticsQueryRequest) {
    return requestJson<AnalyticsRow[]>('/api/v1/analytics/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async heatmap(request: HeatmapRequest) {
    return requestJson<WeekdayHeatmapCell[] | CalendarHeatmapCell[]>('/api/v1/analytics/heatmap', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async listTemplates(params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return requestJson<TemplateSummary[]>(`/api/v1/templates${query.size ? `?${query}` : ''}`);
  },

  async createTemplate(request: CreateTemplateRequest) {
    return requestJson<TemplateSummary>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async exportAlarms(request: ExportRequest) {
    const response = await fetch(`${API_BASE_URL}/api/v1/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
      throw {
        status: response.status,
        code: payload?.success === false ? payload.error.code : 'EXPORT_FAILED',
        message: payload?.success === false ? payload.error.message : response.statusText,
      } satisfies ApiErrorShape;
    }

    return response.blob();
  },
};
