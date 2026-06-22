import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, RadioTower, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type {
  AnalyticsRow,
  CalendarHeatmapCell,
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
      | 'kpi-devices'
      | 'kpi-status'
      | 'chart-trend'
      | 'chart-severity'
      | 'chart-weekly'
      | 'chart-heatmap'
      | 'chart-extra'
      | 'table-alarms';
  };
  onSettingsClick: () => void;
}

const darkTooltipProps = {
  contentStyle: {
    backgroundColor: '#0c0b14',
    border: '1px solid rgba(255, 45, 133, 0.45)',
    borderRadius: '6px',
    color: '#f3edff',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
  },
  labelStyle: {
    color: '#00f5d4',
    fontWeight: 700,
  },
  itemStyle: {
    color: '#f3edff',
  },
  cursor: {
    fill: 'rgba(255, 45, 133, 0.08)',
    stroke: 'rgba(255, 45, 133, 0.28)',
  },
};

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

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCalendarYearRange(startDate: string) {
  const year = Number(startDate.slice(0, 4)) || new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  return {
    from_time: `${year}-01-01`,
    to_time: year === currentYear ? getCurrentIsoDate() : `${year}-12-31`,
  };
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
  count: 'Số lượng',
  avg_duration: 'Thời gian TB',
  max_duration: 'Thời gian tối đa',
  affected_devices: 'Thiết bị ảnh hưởng',
};

const groupLabels: Record<GroupBy, string> = {
  severity: 'Mức độ',
  status: 'Trạng thái',
  error_code: 'Mã lỗi',
  device: 'Thiết bị',
  device_type: 'Loại thiết bị',
  vendor: 'Nhà cung cấp',
  station: 'Trạm',
  province: 'Tỉnh thành',
};

const chartTypeLabels: Record<WidgetSettingsValues['chartType'], string> = {
  line: 'Đường',
  bar: 'Cột',
  pie: 'Tròn',
  table: 'Bảng',
  heatmap: 'Bản đồ nhiệt',
};

const timeBucketLabels: Record<WidgetSettingsValues['timeBucket'], string> = {
  hour: 'giờ',
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
  year: 'năm',
};

const heatmapModeLabels: Record<WidgetSettingsValues['heatmapMode'], string> = {
  weekday: 'theo tuần',
  calendar: 'theo năm',
};

function getRowGroupLabel(row: AnalyticsRow, groupBy: WidgetSettingsValues['groupBy']) {
  if (groupBy === 'none') return row.label ? String(row.label) : 'Tổng';
  const value = row[groupBy];
  return value === null || value === undefined || value === '' ? 'Không xác định' : String(value);
}

function formatMetricValue(value: number, metric: Metric) {
  if (metric === 'avg_duration' || metric === 'max_duration') {
    if (value >= 3600) return `${(value / 3600).toFixed(1).replace(/\.0$/, '')} giờ`;
    if (value >= 60) return `${(value / 60).toFixed(1).replace(/\.0$/, '')} phút`;
    return `${Math.round(value).toLocaleString('vi-VN')} giây`;
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

export function DashboardWidget({ id, config, onSettingsClick }: DashboardWidgetProps) {
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

  const dateFilters =
    isHeatmap && config.heatmapMode === 'calendar'
      ? getCalendarYearRange(config.startDate)
      : {
          from_time: config.startDate,
          to_time: config.endDate,
        };
  const settingSummary = [
    chartTypeLabels[config.chartType],
    !isSummary && isAnalyticsChart ? metricLabels[config.metric] : null,
    !isSummary && hasGroupBy && config.groupBy !== 'none' ? groupLabels[config.groupBy] : null,
    !isSummary && shouldBucketByTime ? `theo ${timeBucketLabels[config.timeBucket]}` : null,
    !isSummary && isHeatmap ? heatmapModeLabels[config.heatmapMode] : null,
    !isSummary && isHeatmap && config.heatmapMode === 'calendar'
      ? `Năm ${dateFilters.from_time.slice(0, 4)}`
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
    queryKey: ['heatmap', id, dateFilters, config.heatmapMode],
    queryFn: () =>
      nettraceApi.heatmap({
        mode: config.heatmapMode,
        filters: dateFilters,
      }),
    enabled: isHeatmap,
  });

  const alarmsQuery = useQuery({
    queryKey: ['alarms', id, dateFilters],
    queryFn: () =>
      nettraceApi.queryAlarms({
        ...dateFilters,
        offset: 0,
        limit: 15,
        sort_by: 'timestamp',
        sort_order: 'desc',
        detail_level: 'compact',
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
    if (isLoading) return <StateBlock state="loading" title="Đang tải..." />;
    if (isError || !data) return <StateBlock state="error" title="Lỗi tải dữ liệu" />;

    if (config.type === 'kpi-count') {
      return (
        <Card className="border-[#ff2d85]/70">
          <CardContent className="min-h-[136px] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[#a69db6]">{config.title}</p>
                <p className="mt-3 text-3xl font-black tabular-nums text-[#f3edff]">
                  {data.totalAlarms.toLocaleString('vi-VN')}
                </p>
                {config.info1 && (
                  <p className="mt-4 text-sm text-[#a69db6]">
                    {data.activeAlarms.toLocaleString('vi-VN')} đang hoạt động · {data.closedAlarms.toLocaleString('vi-VN')} đã đóng
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                {config.info2 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-[#ff2d85]/20">
                    <RadioTower className="text-[#ff2d85]" size={20} />
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (config.type === 'kpi-devices') {
      return (
        <Card className="border-[#00f5d4]/70">
          <CardContent className="min-h-[136px] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[#a69db6]">{config.title}</p>
                <p className="mt-3 text-3xl font-black tabular-nums text-[#f3edff]">
                  {data.affectedDevices.toLocaleString('vi-VN')}
                </p>
                {config.info1 && (
                  <p className="mt-4 text-sm text-[#a69db6]">
                    {data.affectedDevices.toLocaleString('vi-VN')} thiết bị duy nhất
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                {config.info2 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-[#00f5d4]/15">
                    <TrendingUp className="text-[#00f5d4]" size={20} />
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (config.type === 'kpi-status') {
      const isWarning = data.criticalAlarms > 0;
      return (
        <Card className="border-[#f8e231]/70">
          <CardContent className="min-h-[136px] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[#a69db6]">{config.title}</p>
                <p className="mt-3 text-3xl font-black tabular-nums text-[#f8e231] drop-shadow-[0_0_10px_rgba(248,226,49,0.45)]">
                  {isWarning ? 'Warning' : 'Normal'}
                </p>
                {config.info1 && (
                  <p className="mt-4 text-sm text-[#a69db6]">
                    {data.criticalAlarms.toLocaleString('vi-VN')} cảnh báo nghiêm trọng
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end">
                {config.info2 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-[#f8e231]/15">
                    <AlertTriangle className="text-[#f8e231]" size={20} />
                  </span>
                )}
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
    renderContent = <StateBlock state="loading" title="Đang tải dữ liệu..." />;
  } else if (isError) {
    renderContent = (
      <StateBlock
        state="error"
        title="Lỗi tải dữ liệu"
        description="Không thể kết nối đến API để lấy thông tin."
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
      renderContent = <StateBlock title="Chưa có dữ liệu" description="Hãy thử thay đổi bộ lọc hoặc thời gian." />;
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
              {config.info1 && <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />}
              <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
              {config.info2 && <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />}
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
              {config.info1 && <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />}
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              {config.info2 && <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />}
              {config.info3 && (
                <Tooltip
                  {...darkTooltipProps}
                  formatter={(value) => [formatMetricValue(Number(value), config.metric), metricLabels[config.metric]]}
                />
              )}
              <Bar dataKey="value" fill="#0f766e" radius={[3, 3, 0, 0]}>
                {trendData.map((entry, index) => (
                  <Cell key={entry.name} fill={index === trendData.length - 2 ? '#ff2d85' : '#0f766e'} />
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
      renderContent = <StateBlock title="Chưa có dữ liệu" description="Chưa có nhóm mức độ nào được trả về." />;
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
                outerRadius={92}
                paddingAngle={1}
                label={config.info2 ? ({ name }) => String(name) : false}
              >
                {severityData.map((entry, index) => (
                  <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
  } else if (isHeatmap) {
    const cells = heatmapQuery.data?.data ?? [];

    if (cells.length === 0) {
      renderContent = <StateBlock title="Chưa có dữ liệu" description="Chưa có ô mật độ nào được trả về." />;
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
          borderColor: 'rgba(255, 45, 133, 0.45)',
          borderWidth: 1,
          textStyle: { color: '#f3edff' },
          formatter: (params: unknown) => {
            const [day, val] = readCalendarHeatmapValue(params);
            return `<strong style="color:#00f5d4">${formatDisplayHeatmapDate(day)}</strong><br/>${val.toLocaleString('vi-VN')} cảnh báo`;
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
          range: [dateFilters.from_time, dateFilters.to_time],
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
          borderColor: 'rgba(255, 45, 133, 0.45)',
          borderWidth: 1,
          textStyle: { color: '#f3edff' },
          formatter: (params: unknown) => {
            const [x, y, val] = readHeatmapValue(params);
            const day = dayLabels[x] ?? '';
            const hour = timeRows[y] ?? 0;
            return `<strong style="color:#00f5d4">${day} ${String(hour).padStart(2, '0')}:00</strong><br/>${val.toLocaleString('vi-VN')} cảnh báo`;
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
    if (rawAlarms.length === 0) {
      renderContent = <StateBlock title="Không có cảnh báo" description="Không tìm thấy cảnh báo nào phù hợp." />;
    } else {
      renderContent = (
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {config.info1 && <th className="border-b border-white/10 px-3 py-3 font-mono text-xs font-semibold uppercase text-[#a69db6]">THỜI GIAN</th>}
                {config.info2 && <th className="border-b border-white/10 px-3 py-3 font-mono text-xs font-semibold uppercase text-[#a69db6]">LOẠI MÃ LỖI</th>}
                {config.info3 && <th className="border-b border-white/10 px-3 py-3 font-mono text-xs font-semibold uppercase text-[#a69db6]">TRẠNG THÁI</th>}
              </tr>
            </thead>
            <tbody>
              {rawAlarms.map((alarm) => (
                <tr key={alarm.alarm_id} className="hover:bg-white/[0.03]">
                  {config.info1 && (
                    <td className="border-b border-white/10 px-3 py-3 font-mono text-xs text-[#a69db6]">
                      {format(parseISO(alarm.time_created), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                  )}
                  {config.info2 && (
                    <td className="border-b border-white/10 px-3 py-3 text-[#cfc7dc]">
                      {alarm.error_details?.name ?? alarm.description ?? alarm.error_code}
                    </td>
                  )}
                  {config.info3 && (
                    <td className="border-b border-white/10 px-3 py-3 text-[#cfc7dc]">
                      <Badge tone={alarm.status.toLowerCase() === 'active' ? 'amber' : 'green'}>
                        {alarm.status.toLowerCase() === 'active' ? 'Hoạt động' : 'Đã đóng'}
                      </Badge>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{config.title}</h2>
          <button
            type="button"
            onClick={onSettingsClick}
            className="p-1 rounded hover:bg-white/10 text-[#a69db6]"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-[#a69db6]">{settingSummary}</p>
      </CardHeader>
      <CardContent>{renderContent}</CardContent>
    </Card>
  );
}
