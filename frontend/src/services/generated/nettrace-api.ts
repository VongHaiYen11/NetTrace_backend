export type Severity = 'critical' | 'major' | 'minor' | 'warning' | 'info' | string;
export type AlarmStatus = 'active' | 'closed' | string;
export type SortBy = 'timestamp' | 'severity' | 'status';
export type SortOrder = 'asc' | 'desc';
export type AlarmSearchField =
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
export type AlarmColumn =
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
  device_name?: string[];
  device_type?: string[];
  vendor?: string[];
  station?: string[];
  station_id?: string[];
  province?: string[];
}

export interface QueryAlarmsParams extends CommonFilters {
  offset?: number;
  limit?: number;
  sort_by?: SortBy;
  sort_order?: SortOrder;
  include_total?: boolean;
  columns?: AlarmColumn[];
  search?: string;
  search_field?: AlarmSearchField;
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

export interface PresetSummary {
  preset_id: number;
  preset_name: string | null;
  chart_type: string;
  metric: string | null;
  group_by: string | null;
  time_bucket: string | null;
  heatmap_mode: string | null;
  table_columns: string | null;
  table_page_size: number | null;
  table_record_limit: number | null;
  template_id?: number | null;
  template_name?: string | null;
}

export interface TemplateWidgetDetail {
  widget_id: number;
  preset_id: number;
  position: number;
  start_date: string | null;
  end_date: string | null;
  time_created: string;
  time_updated: string;
  preset: PresetSummary;
}

export interface TemplateDetail extends TemplateSummary {
  widgets: TemplateWidgetDetail[];
}

export interface TemplateWidgetInput {
  preset_id?: number | null;
  preset_name?: string | null;
  position: number;
  chart_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  metric?: string | null;
  group_by?: string | null;
  time_bucket?: string | null;
  heatmap_mode?: string | null;
  table_columns?: string | null;
  table_page_size?: number | null;
  table_record_limit?: number | null;
}

export interface CreateTemplateRequest {
  name: string;
  selected_cards?: string | null;
  widgets?: TemplateWidgetInput[];
}

export interface UpdateTemplateRequest {
  name?: string;
  selected_cards?: string | null;
  widgets?: TemplateWidgetInput[];
}

export interface CreatePresetRequest {
  preset_name: string;
  chart_type: string;
  metric?: string | null;
  group_by?: string | null;
  time_bucket?: string | null;
  heatmap_mode?: string | null;
  table_columns?: string | null;
  table_page_size?: number | null;
  table_record_limit?: number | null;
}

export interface MetadataFilterOptions {
  deviceTypes: string[];
  vendors: string[];
  stations: string[];
  provinces: string[];
}

export type ExportColumn = AlarmColumn;

export interface ExportRequest {
  format: 'csv' | 'xlsx' | 'json';
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
  appendArrayParam(params, 'device_name', filters.device_name);
  appendArrayParam(params, 'device_type', filters.device_type);
  appendArrayParam(params, 'vendor', filters.vendor);
  appendArrayParam(params, 'station', filters.station);
  appendArrayParam(params, 'station_id', filters.station_id);
  appendArrayParam(params, 'province', filters.province);

  const alarmFilters = filters as QueryAlarmsParams;
  if (alarmFilters.offset !== undefined) params.set('offset', String(alarmFilters.offset));
  if (alarmFilters.limit !== undefined) params.set('limit', String(alarmFilters.limit));
  if (alarmFilters.sort_by) params.set('sort_by', alarmFilters.sort_by);
  if (alarmFilters.sort_order) params.set('sort_order', alarmFilters.sort_order);
  if (alarmFilters.include_total !== undefined) {
    params.set('include_total', String(alarmFilters.include_total));
  }
  appendArrayParam(params, 'columns', alarmFilters.columns);
  if (alarmFilters.search) params.set('search', alarmFilters.search);
  if (alarmFilters.search_field) params.set('search_field', alarmFilters.search_field);
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

  async getMetadataOptions(params: { search?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    return requestJson<MetadataFilterOptions>(
      `/api/v1/metadata/options${query.size ? `?${query}` : ''}`,
    );
  },

  async listTemplates(params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return requestJson<TemplateSummary[]>(`/api/v1/templates${query.size ? `?${query}` : ''}`);
  },

  async listPresets(params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return requestJson<PresetSummary[]>(`/api/v1/presets${query.size ? `?${query}` : ''}`);
  },

  async createPreset(request: CreatePresetRequest) {
    return requestJson<PresetSummary>('/api/v1/presets', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async updatePreset(id: number, request: CreatePresetRequest) {
    return requestJson<PresetSummary>(`/api/v1/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  async deletePresets(ids: number[]) {
    return requestJson<{ deletedCount: number }>('/api/v1/presets', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  },

  async createTemplate(request: CreateTemplateRequest) {
    return requestJson<TemplateSummary>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async updateTemplate(id: number, request: UpdateTemplateRequest) {
    return requestJson<TemplateSummary>(`/api/v1/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  async deleteTemplate(id: number) {
    return requestJson<void>(`/api/v1/templates/${id}`, {
      method: 'DELETE',
    });
  },

  async getTemplateDetail(id: number) {
    return requestJson<TemplateDetail>(`/api/v1/templates/${id}`);
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
