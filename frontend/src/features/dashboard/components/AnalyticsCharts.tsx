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
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { AnalyticsRow } from '../../../services/generated/nettrace-api';

interface AnalyticsChartsProps {
  trend?: AnalyticsRow[];
  severity?: AnalyticsRow[];
  isTrendLoading: boolean;
  isSeverityLoading: boolean;
  isTrendError: boolean;
  isSeverityError: boolean;
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

function rowLabel(row: AnalyticsRow) {
  if (row.label) return String(row.label);
  if (row.time_bucket) return formatBucket(String(row.time_bucket));
  return 'Tổng';
}

function formatBucket(value: string) {
  try {
    return format(parseISO(value), 'MMM d');
  } catch {
    return value;
  }
}

export function AnalyticsCharts({
  trend,
  severity,
  isTrendLoading,
  isSeverityLoading,
  isTrendError,
  isSeverityError,
}: AnalyticsChartsProps) {
  const trendData = (trend ?? []).map((row) => ({
    name: rowLabel(row),
    value: row.value,
  }));
  const severityData = (severity ?? []).map((row) => ({
    name: String(row.severity ?? 'Không xác định'),
    value: row.value,
  }));
  const pieColors = ['#ff2d85', '#00f5d4', '#f8e231', '#7c3aed', '#38bdf8', '#f97316'];

  return (
    <section className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <h2 className="text-xl font-bold">Cảnh báo theo ngày</h2>
        </CardHeader>
        <CardContent>
          {isTrendLoading ? (
            <StateBlock state="loading" title="Đang tải xu hướng cảnh báo" />
          ) : isTrendError || trendData.length === 0 ? (
            <StateBlock title="Chưa có dữ liệu xu hướng" description="Hãy thử khoảng thời gian hoặc bộ lọc khác." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff2d85" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#ff2d85" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />
                  <Tooltip {...darkTooltipProps} formatter={(value: any) => [formatNumberWithSuffix(Number(value)), 'Số lượng']} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ff2d85"
                    strokeWidth={2}
                    fill="url(#volume)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <h2 className="text-xl font-bold">Phân bố mức độ</h2>
        </CardHeader>
        <CardContent>
          {isSeverityLoading ? (
            <StateBlock state="loading" title="Đang tải mức độ" />
          ) : isSeverityError || severityData.length === 0 ? (
            <StateBlock title="Chưa có dữ liệu mức độ" description="Chưa có nhóm mức độ nào được trả về." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...darkTooltipProps} />
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={92}
                    paddingAngle={1}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

interface WeeklyAlarmChartProps {
  trend?: AnalyticsRow[];
  isLoading: boolean;
  isError: boolean;
}

export function WeeklyAlarmChart({ trend, isLoading, isError }: WeeklyAlarmChartProps) {
  const weeklyData = (trend ?? []).slice(-7).map((row) => ({
    name: rowLabel(row).slice(0, 3).toUpperCase(),
    value: row.value,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Cảnh báo (tuần này)</h2>
          <MoreDots />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StateBlock state="loading" title="Đang tải cảnh báo tuần" />
        ) : isError || weeklyData.length === 0 ? (
          <StateBlock title="Chưa có dữ liệu tuần" description="Chưa có nhóm cảnh báo tuần nào được trả về." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip {...darkTooltipProps} />
                <Bar dataKey="value" fill="#0f766e" radius={[3, 3, 0, 0]}>
                  {weeklyData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={index === weeklyData.length - 2 ? '#ff2d85' : '#0f766e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoreDots() {
  return <span className="font-mono text-lg leading-none text-[#a69db6]">•••</span>;
}
