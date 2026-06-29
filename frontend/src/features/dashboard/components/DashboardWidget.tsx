import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, RadioTower, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { StateBlock } from '../../../components/shared/StateBlock';
import { nettraceApi } from '../../../services/generated/nettrace-api';
import { cn } from '../../../utils/cn';
import type {
  AnalyticsRow,
  Alarm,
  CalendarHeatmapCell,
  ExportColumn,
  GroupBy,
  Metric,
  WeekdayHeatmapCell,
} from '../../../services/generated/nettrace-api';
import type { WidgetSettingsValues } from './WidgetSettingsDrawer';

interface DashboardWidgetProps {
  id: string;
  config: WidgetSettingsValues & {
    title: string;
    type:
      | 'kpi-count'
      | 'kpi-total'
      | 'kpi-active'
      | 'kpi-closed'
      | 'kpi-devices'
      | 'kpi-status'
      | 'kpi-critical'
      | 'chart-trend'
      | 'chart-severity'
      | 'chart-weekly'
      | 'chart-heatmap'
      | 'chart-extra'
      | 'table-alarms';
  };
  layoutContext?: {
    isLastVisibleWidget: boolean;
    hasRowMate: boolean;
    tableHeightMode: 'paired' | 'middle' | 'roomy';
  };
  onSettingsClick: () => void;
}

const darkTooltipProps = {
  contentStyle: {
    backgroundColor: '#0c0b14',
    border: '1px solid var(--chart-primary-45)',
    borderRadius: '6px',
    color: '#f3edff',
    boxShadow: 'var(--chart-shadow)',
  },
  labelStyle: {
    color: '#00f5d4',
    fontWeight: 700,
  },
  itemStyle: {
    color: '#f3edff',
  },
  cursor: {
    fill: 'var(--chart-primary-08)',
    stroke: 'var(--chart-primary-28)',
  },
};

function normalizeKpiType(type: DashboardWidgetProps['config']['type']) {
  if (type === 'kpi-count') return 'kpi-total';
  if (type === 'kpi-status') return 'kpi-critical';
  return type;
}

function getKpiStatusTone(ratio: number, inverse = false) {
  const score = inverse ? 1 - ratio : ratio;
  if (score >= 0.8) {
    return {
      border: 'border-primary/80',
      iconBg: 'bg-primary/18',
      tone: 'text-primary-light',
      valueClass: 'text-primary-light drop-shadow-glow-primary',
    };
  }
  if (score >= 0.5) {
    return {
      border: 'border-warning/75',
      iconBg: 'bg-warning/15',
      tone: 'text-warning',
      valueClass: 'text-warning drop-shadow-glow-warning',
    };
  }
  return {
    border: 'border-secondary/70',
    iconBg: 'bg-secondary/15',
    tone: 'text-secondary',
    valueClass: 'text-secondary drop-shadow-glow-secondary',
  };
}

function formatNumberWithSuffix(val: number): string {
  if (val >= 1000000) {
    return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (val >= 1000) {
    return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(val);
}

function formatBucket(value: string) {
  try {
    return format(parseISO(value.replace(' ', 'T')), 'dd/MM');
  } catch {
    return value;
  }
}

function formatDisplayHeatmapDate(value: string) {
  try {
    return format(parseISO(value), 'dd/MM/yyyy');
  } catch {
    return value;
  }
}

function formatDateRangeBadge(startDate?: string, endDate?: string) {
  const formatDateOnly = (value?: string) => {
    if (!value) return 'N/A';
    try {
      return format(parseISO(value.slice(0, 10)), 'dd/MM/yyyy');
    } catch {
      return value.slice(0, 10) || 'N/A';
    }
  };

  return `${formatDateOnly(startDate)} - ${formatDateOnly(endDate)}`;
}

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekRangeForDateValue(value?: string) {
  const start = new Date(`${value?.slice(0, 10) || getCurrentIsoDate()}T00:00:00.000Z`);
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return {
    from_time: start.toISOString(),
    to_time: end.toISOString(),
  };
}

function getWidgetDateFilters(startDate?: string, endDate?: string) {
  return {
    from_time: startDate || undefined,
    to_time: endDate || undefined,
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCalendarYearRange(startDate: string) {
  const year = Number(startDate.slice(0, 4)) || new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const yearEnd = new Date(`${year}-12-31T00:00:00.000Z`);
  const requestedEnd = year === currentYear ? new Date(`${getCurrentIsoDate()}T00:00:00.000Z`) : yearEnd;
  const end = requestedEnd > yearEnd ? yearEnd : requestedEnd;

  return {
    from_time: `${year}-01-01`,
    to_time: toIsoDate(end),
  };
}

function getCalendarYearChunks(startDate: string) {
  const range = getCalendarYearRange(startDate);
  const chunks: Array<{ from_time: string; to_time: string }> = [];
  let cursor = new Date(`${range.from_time}T00:00:00.000Z`);
  const end = new Date(`${range.to_time}T00:00:00.000Z`);

  while (cursor <= end) {
    const chunkEnd = addDays(cursor, 88);
    const boundedEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({
      from_time: toIsoDate(cursor),
      to_time: toIsoDate(boundedEnd),
    });
    cursor = addDays(boundedEnd, 1);
  }

  return chunks;
}

function getTimeBucketMs(row: AnalyticsRow) {
  if (!row.time_bucket) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(String(row.time_bucket).replace(' ', 'T'));
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getSortedTrendRows(rows: AnalyticsRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = getTimeBucketMs(a);
    const bTime = getTimeBucketMs(b);
    if (aTime !== bTime) return aTime - bTime;
    return String(a.time_bucket ?? a.label ?? '').localeCompare(String(b.time_bucket ?? b.label ?? ''));
  });
}

const metricLabels: Record<Metric, string> = {
  count: 'Count',
  avg_duration: 'Avg time',
  max_duration: 'Max time',
  affected_devices: 'Affected devices',
};

const groupLabels: Record<GroupBy, string> = {
  severity: 'Severity',
  status: 'Status',
  error_code: 'Error code',
  device: 'Device',
  device_type: 'Device type',
  vendor: 'Vendor',
  station: 'Station',
  province: 'Province',
};

const chartTypeLabels: Record<WidgetSettingsValues['chartType'], string> = {
  line: 'Line',
  bar: 'Bar',
  pie: 'Pie',
  table: 'Table',
  heatmap: 'Heatmap',
};

const timeBucketLabels: Record<WidgetSettingsValues['timeBucket'], string> = {
  hour: 'h',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const heatmapModeLabels: Record<WidgetSettingsValues['heatmapMode'], string> = {
  weekday: 'theo week',
  calendar: 'theo year',
};

function getRowGroupLabel(row: AnalyticsRow, groupBy: WidgetSettingsValues['groupBy']) {
  if (groupBy === 'none') return row.label ? String(row.label) : 'Total';
  const value = row[groupBy];
  return value === null || value === undefined || value === '' ? 'Unknown' : String(value);
}

function formatMetricValue(value: number, metric: Metric) {
  if (metric === 'avg_duration' || metric === 'max_duration') {
    if (value >= 3600) return `${(value / 3600).toFixed(1).replace(/\.0$/, '')} h`;
    if (value >= 60) return `${(value / 60).toFixed(1).replace(/\.0$/, '')} min`;
    return `${Math.round(value).toLocaleString('vi-VN')} sec`;
  }
  return formatNumberWithSuffix(value);
}

function readHeatmapValue(params: unknown) {
  if (!params || typeof params !== 'object' || !('value' in params)) {
    return [0, 0, 0] as const;
  }
  const rawValue = (params as { value?: unknown }).value;
  if (!Array.isArray(rawValue)) {
    return [0, 0, 0] as const;
  }
  const [x, y, value] = rawValue.map((item) => Number(item));
  return [x || 0, y || 0, value || 0] as const;
}

function readCalendarHeatmapValue(params: unknown) {
  if (!params || typeof params !== 'object' || !('value' in params)) {
    return ['', 0] as const;
  }
  const rawValue = (params as { value?: unknown }).value;
  if (!Array.isArray(rawValue)) {
    return ['', 0] as const;
  }
  return [String(rawValue[0] ?? ''), Number(rawValue[1] ?? 0)] as const;
}

const tableHeightClassByMode: Record<NonNullable<DashboardWidgetProps['layoutContext']>['tableHeightMode'], string> = {
  paired: 'max-h-[320px]',
  middle: 'max-h-[360px]',
  roomy: 'max-h-[520px]',
};

const DEFAULT_TABLE_RECORD_LIMIT = 15;
const DEFAULT_TABLE_TOTAL_RECORDS = 200;
const MAX_TABLE_RECORD_LIMIT = 200;
const MAX_TABLE_TOTAL_RECORDS = 1000;

function getTablePageSize(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_RECORD_LIMIT;
  return Math.min(MAX_TABLE_RECORD_LIMIT, Math.max(1, Math.trunc(numericValue)));
}

function getTableRecordLimit(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_TOTAL_RECORDS;
  return Math.min(MAX_TABLE_TOTAL_RECORDS, Math.max(1, Math.trunc(numericValue)));
}

const tableColumnLabels: Record<ExportColumn, string> = {
  alarm_id: 'Alarm ID',
  time_created: 'Time',
  time_solved: 'Solved',
  status: 'Status',
  severity: 'Severity',
  error_code: 'Error code',
  error_name: 'Error name',
  error_domain: 'Domain',
  device_id: 'Device ID',
  device_name: 'Device name',
  device_type: 'Device type',
  station_name: 'Station',
  station_province: 'Province',
  vendor_name: 'Vendor',
  raw_log: 'Raw log',
  description: 'Description',
};

const defaultTableColumns: ExportColumn[] = [
  'time_created',
  'error_name',
  'status',
  'severity',
  'device_name',
  'description',
];

function renderAlarmTableCell(alarm: Alarm, column: ExportColumn) {
  if (column === 'time_created') {
    return <span className="font-mono text-xs text-muted">{format(parseISO(alarm.time_created), 'dd/MM/yyyy HH:mm:ss')}</span>;
  }
  if (column === 'time_solved') {
    return alarm.time_solved ? <span className="font-mono text-xs text-muted">{format(parseISO(alarm.time_solved), 'dd/MM/yyyy HH:mm:ss')}</span> : 'N/A';
  }
  if (column === 'status') {
    return (
      <Badge tone={alarm.status.toLowerCase() === 'active' ? 'amber' : 'green'}>
        {alarm.status.toLowerCase() === 'active' ? 'Active' : 'Closed'}
      </Badge>
    );
  }
  if (column === 'error_name') return alarm.error_details?.name ?? alarm.description ?? alarm.error_code;
  if (column === 'error_domain') return alarm.error_details?.domain ?? 'N/A';
  if (column === 'device_name') return alarm.device_details?.name ?? alarm.device_id;
  if (column === 'device_type') return alarm.device_details?.device_type ?? 'N/A';
  if (column === 'station_name') return alarm.device_details?.station_name ?? 'N/A';
  if (column === 'station_province') return alarm.device_details?.station_province ?? 'N/A';
  if (column === 'vendor_name') return alarm.device_details?.vendor_name ?? 'N/A';
  return alarm[column] ?? 'N/A';
}

export function DashboardWidget({ id, config, layoutContext, onSettingsClick }: DashboardWidgetProps) {
  if (!config.visible) return null;

  const isSummary = config.type.startsWith('kpi');
  const isAnalyticsChart =
    !isSummary && (config.chartType === 'line' || config.chartType === 'bar' || config.chartType === 'pie');
  const isTrend = isAnalyticsChart && (config.chartType === 'line' || config.chartType === 'bar');
  const isPie = isAnalyticsChart && config.chartType === 'pie';
  const isHeatmap = !isSummary && config.chartType === 'heatmap';
  const isTable = !isSummary && config.chartType === 'table';
  const selectedGroupBy = config.groupBy === 'none' ? null : config.groupBy;
  const hasGroupBy = selectedGroupBy !== null;
  const chartUsesGroup = config.chartType === 'pie' || (config.chartType === 'bar' && hasGroupBy);
  const analyticsGroupBy: GroupBy[] = chartUsesGroup && selectedGroupBy ? [selectedGroupBy] : [];
  const shouldBucketByTime = config.chartType === 'line' || (config.chartType === 'bar' && !hasGroupBy);
  const analyticsTimeBucket = shouldBucketByTime ? config.timeBucket : null;
  const tableHeightMode = layoutContext?.tableHeightMode ?? 'middle';
  const tableHeightClass = tableHeightClassByMode[tableHeightMode];
  const visibleTableColumns = config.tableColumns && config.tableColumns.length > 0
    ? config.tableColumns
    : defaultTableColumns;
  const tablePageSize = getTablePageSize(config.tablePageSize ?? config.tableRecordLimit);
  const tableRecordLimit = getTableRecordLimit(config.tableRecordLimit);
  const [tablePageIndex, setTablePageIndex] = useState(0);
  const tableQueryOffset = tablePageIndex * tablePageSize;
  const tableQueryLimit = Math.max(1, Math.min(tablePageSize, tableRecordLimit - tableQueryOffset));

  const dateFilters =
    isHeatmap && config.heatmapMode === 'calendar'
      ? getCalendarYearRange(config.startDate)
      : isHeatmap && config.heatmapMode === 'weekday'
        ? getWeekRangeForDateValue(config.startDate)
      : getWidgetDateFilters(config.startDate, config.endDate);
  const heatmapFilterChunks =
    isHeatmap && config.heatmapMode === 'calendar'
      ? getCalendarYearChunks(config.startDate)
      : [dateFilters];

  useEffect(() => {
    setTablePageIndex(0);
  }, [id, dateFilters.from_time, dateFilters.to_time, visibleTableColumns.join(','), tablePageSize, tableRecordLimit]);
  const settingSummary = [
    chartTypeLabels[config.chartType],
    !isSummary && isAnalyticsChart ? metricLabels[config.metric] : null,
    !isSummary && hasGroupBy && config.groupBy !== 'none' ? groupLabels[config.groupBy] : null,
    !isSummary && shouldBucketByTime ? `theo ${timeBucketLabels[config.timeBucket]}` : null,
    !isSummary && isHeatmap ? heatmapModeLabels[config.heatmapMode] : null,
    !isSummary && isHeatmap && config.heatmapMode === 'calendar'
      ? `Year ${(dateFilters.from_time ?? getCurrentIsoDate()).slice(0, 4)}`
      : `${config.startDate} - ${config.endDate}`,
  ].filter(Boolean).join(' · ');

  // Queries
  const summaryQuery = useQuery({
    queryKey: ['summary', id, dateFilters],
    queryFn: () => nettraceApi.getSummary(dateFilters),
    enabled: isSummary,
  });

  const analyticsQuery = useQuery({
    queryKey: [
      'analytics-widget',
      id,
      dateFilters,
      config.chartType,
      config.metric,
      config.groupBy,
      config.timeBucket,
    ],
    queryFn: () =>
      nettraceApi.analyticsQuery({
        metric: config.metric,
        group_by: analyticsGroupBy,
        time_bucket: analyticsTimeBucket,
        filters: dateFilters,
        limit: 90,
      }),
    enabled: isAnalyticsChart,
  });

  const heatmapQuery = useQuery({
    queryKey: ['heatmap', id, dateFilters, heatmapFilterChunks, config.heatmapMode],
    queryFn: async () => {
      if (config.heatmapMode !== 'calendar') {
        return nettraceApi.heatmap({
          mode: 'weekday',
          filters: dateFilters,
        });
      }

      const responses = await Promise.all(
        heatmapFilterChunks.map((filters) =>
          nettraceApi.heatmap({
            mode: 'calendar',
            filters,
          }),
        ),
      );
      const byDay = new Map<string, number>();

      responses.forEach((response) => {
        (response.data as CalendarHeatmapCell[]).forEach((cell) => {
          byDay.set(cell.day, (byDay.get(cell.day) ?? 0) + cell.value);
        });
      });

      return {
        success: true,
        data: Array.from(byDay.entries()).map(([day, value]) => ({ day, value })),
        meta: {
          chunks: heatmapFilterChunks.length,
        },
      } as const;
    },
    enabled: isHeatmap,
  });

  const alarmsQuery = useQuery({
    queryKey: ['alarms', id, dateFilters, visibleTableColumns, tablePageSize, tableRecordLimit, tablePageIndex],
    queryFn: () =>
      nettraceApi.queryAlarms({
        ...dateFilters,
        offset: tableQueryOffset,
        limit: tableQueryLimit,
        sort_by: 'timestamp',
        sort_order: 'desc',
        include_total: true,
        columns: visibleTableColumns,
      }),
    enabled: isTable,
  });

  const isLoading =
    summaryQuery.isLoading ||
    analyticsQuery.isLoading ||
    heatmapQuery.isLoading ||
    alarmsQuery.isLoading;

  const isError =
    summaryQuery.isError ||
    analyticsQuery.isError ||
    heatmapQuery.isError ||
    alarmsQuery.isError;

  // Render KPI Card Widgets
  if (isSummary) {
    const data = summaryQuery.data?.data;
    if (isLoading) return <StateBlock state="loading" title="Loading..." />;
    if (isError || !data) return <StateBlock state="error" title="Data load failed" />;

    const kpiType = normalizeKpiType(config.type);
    const totalAlarms = Math.max(data.totalAlarms, 1);
    const alarmHealthTone = getKpiStatusTone(data.criticalAlarms / totalAlarms);
    const totalTone = alarmHealthTone;
    const activeTone = alarmHealthTone;
    const closedTone = getKpiStatusTone(data.closedAlarms / totalAlarms, true);
    const criticalTone = getKpiStatusTone(data.criticalAlarms / totalAlarms);
    const deviceTone = getKpiStatusTone(0);
    const kpiConfig = {
      'kpi-total': {
        value: data.totalAlarms.toLocaleString('vi-VN'),
        subtitle: `${data.activeAlarms.toLocaleString('vi-VN')} active · ${data.closedAlarms.toLocaleString('vi-VN')} closed`,
        ...totalTone,
        Icon: RadioTower,
      },
      'kpi-active': {
        value: data.activeAlarms.toLocaleString('vi-VN'),
        subtitle: `${data.activeAlarms.toLocaleString('vi-VN')} active alarms`,
        ...activeTone,
        Icon: RadioTower,
      },
      'kpi-closed': {
        value: data.closedAlarms.toLocaleString('vi-VN'),
        subtitle: `${data.closedAlarms.toLocaleString('vi-VN')} closed alarms`,
        ...closedTone,
        Icon: MoreHorizontal,
      },
      'kpi-devices': {
        value: data.affectedDevices.toLocaleString('vi-VN'),
        subtitle: `${data.affectedDevices.toLocaleString('vi-VN')} unique devices`,
        ...deviceTone,
        Icon: TrendingUp,
      },
      'kpi-critical': {
        value: data.criticalAlarms.toLocaleString('vi-VN'),
        subtitle: `${data.criticalAlarms.toLocaleString('vi-VN')} critical alarms`,
        ...criticalTone,
        Icon: AlertTriangle,
      },
    }[kpiType as 'kpi-total' | 'kpi-active' | 'kpi-closed' | 'kpi-devices' | 'kpi-critical'];

    if (kpiConfig) {
      const Icon = kpiConfig.Icon;
      return (
        <Card className={kpiConfig.border}>
          <CardContent className="min-h-[136px] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-muted">{config.title}</p>
                <p className={cn('mt-3 text-3xl font-black tabular-nums', kpiConfig.valueClass)}>
                  {kpiConfig.value}
                </p>
                {config.info1 && (
                  <p className="mt-4 text-sm text-muted">{kpiConfig.subtitle}</p>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded', kpiConfig.iconBg)}>
                  <Icon className={kpiConfig.tone} size={20} />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  // Render Chart / Table Widgets
  let renderContent = null;

  if (isLoading) {
    renderContent = <StateBlock state="loading" title="Loading data..." />;
  } else if (isError) {
    renderContent = (
      <StateBlock
        state="error"
        title="Data load failed"
        description="Could not connect to the API."
      />
    );
  } else if (isTrend) {
    const rawTrend = shouldBucketByTime
      ? getSortedTrendRows(analyticsQuery.data?.data ?? [])
      : analyticsQuery.data?.data ?? [];
    const trendData = rawTrend.map((row) => ({
      name: shouldBucketByTime && row.time_bucket
        ? formatBucket(String(row.time_bucket))
        : getRowGroupLabel(row, config.groupBy),
      value: row.value,
    }));

    if (trendData.length === 0) {
      renderContent = <StateBlock title="No data" description="Try another filter or time range." />;
    } else if (config.chartType === 'line') {
      renderContent = (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <defs>
                <linearGradient id={`volume-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff2d85" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="#ff2d85" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {config.info1 && <CartesianGrid stroke="var(--chart-grid)" vertical={false} />}
              <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />
              {config.info3 && (
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value) => [formatMetricValue(Number(value), config.metric), metricLabels[config.metric]]}
                />
              )}
              <Area type="monotone" dataKey="value" stroke="#ff2d85" strokeWidth={2} fill={`url(#volume-${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    } else {
      // bar
      renderContent = (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              {config.info1 && <CartesianGrid stroke="var(--chart-grid)" vertical={false} />}
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />
              {config.info3 && (
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value) => [formatMetricValue(Number(value), config.metric), metricLabels[config.metric]]}
                />
              )}
              <Bar dataKey="value" fill="#0f766e" radius={[3, 3, 0, 0]}>
                {trendData.map((entry, index) => (
                  <Cell key={entry.name} fill={config.groupBy === 'none' && index === trendData.length - 2 ? '#ff2d85' : '#0f766e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  } else if (isPie) {
    const rawSeverity = analyticsQuery.data?.data ?? [];
    const severityData = rawSeverity.map((row) => ({
      name: getRowGroupLabel(row, config.groupBy),
      value: row.value,
    }));
    const pieColors = ['#ff2d85', '#00f5d4', '#f8e231', '#7c3aed', '#38bdf8', '#f97316'];

    if (severityData.length === 0) {
      renderContent = <StateBlock title="No data" description="No severity groups returned." />;
    } else {
      renderContent = (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {config.info1 && (
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value) => [formatMetricValue(Number(value), config.metric), metricLabels[config.metric]]}
                />
              )}
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={config.info2 ? 80 : 92}
                paddingAngle={1}
                label={false}
              >
                {severityData.map((entry, index) => (
                  <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              {config.info2 && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs font-mono text-muted">{value}</span>}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
  } else if (isHeatmap) {
    const cells = heatmapQuery.data?.data ?? [];

    if (cells.length === 0) {
      renderContent = <StateBlock title="No data" description="No heatmap cells returned." />;
    } else if (config.heatmapMode === 'calendar') {
      const calendarCells = cells as CalendarHeatmapCell[];
      const max = calendarCells.reduce((current, cell) => Math.max(current, cell.value), 0);
      const option: EChartsOption = {
        backgroundColor: 'transparent',
        animation: true,
        tooltip: {
          show: config.info1,
          position: 'top',
          backgroundColor: '#0c0b14',
          borderColor: 'var(--chart-primary-45)',
          borderWidth: 1,
          textStyle: { color: '#f3edff' },
          formatter: (params: unknown) => {
            const [day, val] = readCalendarHeatmapValue(params);
            return `<strong style="color:#00f5d4">${formatDisplayHeatmapDate(day)}</strong><br/>${val.toLocaleString('vi-VN')} alarms`;
          },
        },
        visualMap: {
          show: false,
          min: 0,
          max,
          inRange: { color: ['#211326', '#3b1835', '#7f1d52', '#c72570', '#ff2d85'] },
        },
        calendar: {
          top: 28,
          left: 36,
          right: 24,
          bottom: 22,
          range: [dateFilters.from_time ?? getCurrentIsoDate(), dateFilters.to_time ?? getCurrentIsoDate()],
          cellSize: ['auto', 18],
          splitLine: { lineStyle: { color: '#2b2740', width: 1 } },
          itemStyle: { color: '#151421', borderColor: '#0c0b14', borderWidth: 2 },
          dayLabel: { show: config.info2, color: '#a69db6', nameMap: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] },
          monthLabel: { show: config.info2, color: '#a69db6', nameMap: 'vi' },
          yearLabel: { show: false },
        },
        series: [
          {
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: calendarCells.map((cell) => [cell.day, cell.value]),
            itemStyle: { borderRadius: 2 },
          },
        ],
      };
      renderContent = (
        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          style={{ height: 260, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      );
    } else {
      const weekdayCells = cells as WeekdayHeatmapCell[];
      const max = weekdayCells.reduce((current, cell) => Math.max(current, cell.value), 0);
      const dayKeys = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const timeRows = [0, 6, 12, 18];

      const byKey = new Map(weekdayCells.map((cell) => [`${cell.y}-${cell.x}`, cell.value]));
      const heatmapData = timeRows.flatMap((hour, yIndex) =>
        dayKeys.map((day, xIndex) => [xIndex, yIndex, byKey.get(`${day}-${hour}`) ?? 0]),
      );

      const option: EChartsOption = {
        backgroundColor: 'transparent',
        animation: true,
        tooltip: {
          show: config.info1,
          position: 'top',
          backgroundColor: '#0c0b14',
          borderColor: 'var(--chart-primary-45)',
          borderWidth: 1,
          textStyle: { color: '#f3edff' },
          formatter: (params: unknown) => {
            const [x, y, val] = readHeatmapValue(params);
            const day = dayLabels[x] ?? '';
            const hour = timeRows[y] ?? 0;
            return `<strong style="color:#00f5d4">${day} ${String(hour).padStart(2, '0')}:00</strong><br/>${val.toLocaleString('vi-VN')} alarms`;
          },
        },
        grid: { left: 48, right: 16, top: 12, bottom: 24, containLabel: false },
        xAxis: {
          type: 'category',
          data: dayLabels,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: config.info2, color: '#a69db6', fontSize: 11 },
        },
        yAxis: {
          type: 'category',
          data: timeRows.map((hour) => `${String(hour).padStart(2, '0')}:00`),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: config.info2, color: '#a69db6', fontSize: 11 },
        },
        visualMap: {
          show: false,
          min: 0,
          max,
          inRange: { color: ['#211326', '#3b1835', '#7f1d52', '#c72570', '#ff2d85'] },
        },
        series: [
          {
            type: 'heatmap',
            data: heatmapData,
            label: { show: false },
            itemStyle: { borderColor: '#151421', borderWidth: 3, borderRadius: 2 },
          },
        ],
      };
      renderContent = (
        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          style={{ height: 260, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      );
    }
  } else if (isTable) {
    const rawAlarms = alarmsQuery.data?.data ?? [];
    const matchingRecords = typeof alarmsQuery.data?.meta?.total === 'number'
      ? alarmsQuery.data.meta.total
      : rawAlarms.length;
    const totalRecords = Math.min(matchingRecords, tableRecordLimit);
    const totalPages = Math.max(1, Math.ceil(totalRecords / tablePageSize));
    const currentPage = Math.min(tablePageIndex + 1, totalPages);
    const showingStart = totalRecords === 0 ? 0 : tablePageIndex * tablePageSize + 1;
    const showingEnd = Math.min((tablePageIndex + 1) * tablePageSize, totalRecords);
    const canGoPrevious = tablePageIndex > 0;
    const canGoNext = tablePageIndex + 1 < totalPages;
    if (rawAlarms.length === 0) {
      renderContent = <StateBlock title="No alarms" description="No matching alarms found." />;
    } else {
      renderContent = (
        <div className="flex flex-col">
          <div className={`overflow-auto ${tableHeightClass}`}>
            <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {visibleTableColumns.map((column) => (
                    <th
                      key={column}
                      className="sticky top-0 z-10 whitespace-nowrap border-b border-white/10 bg-panel-light px-3 py-3 font-mono text-xs font-semibold uppercase text-muted"
                    >
                      {tableColumnLabels[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawAlarms.map((alarm) => (
                  <tr key={alarm.alarm_id} className="hover:bg-white/[0.03]">
                    {visibleTableColumns.map((column) => (
                      <td
                        key={column}
                        className="max-w-[18rem] truncate whitespace-nowrap border-b border-white/10 px-3 py-3 text-medium"
                      >
                        {renderAlarmTableCell(alarm, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-muted">
            <span>
              Showing {showingStart}-{showingEnd} of {totalRecords}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                disabled={!canGoPrevious}
                onClick={() => setTablePageIndex((page) => Math.max(0, page - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {currentPage} / {totalPages}</span>
              <button
                type="button"
                className="rounded p-1 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                disabled={!canGoNext}
                onClick={() => setTablePageIndex((page) => page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{config.title}</h2>
            <span className="mt-2 inline-flex max-w-full rounded border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[11px] font-semibold text-muted">
              {formatDateRangeBadge(config.startDate, config.endDate)}
            </span>
          </div>
          <button
            type="button"
            onClick={onSettingsClick}
            className="rounded p-1 text-muted hover:bg-white/10"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </CardHeader>
      <CardContent>{renderContent}</CardContent>
    </Card>
  );
}
