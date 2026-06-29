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
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { StateBlock } from '../../../components/shared/StateBlock';
import type { AnalyticsRow } from '../../../services/generated/nettrace-api';
import { groupSmallPieSlices } from '../utils/pieData';

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
  return 'Total';
}

function formatBucket(value: string) {
  try {
    return format(parseISO(value.replace(' ', 'T')), 'dd/MM');
  } catch {
    return value;
  }
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

export function AnalyticsCharts({
  trend,
  severity,
  isTrendLoading,
  isSeverityLoading,
  isTrendError,
  isSeverityError,
}: AnalyticsChartsProps) {
  const trendData = getSortedTrendRows(trend ?? []).map((row) => ({
    name: rowLabel(row),
    value: row.value,
  }));
  const severityData = groupSmallPieSlices((severity ?? []).map((row) => ({
    name: String(row.severity ?? 'Unknown'),
    value: row.value,
  })));
  const pieColors = ['#ff2d85', '#00f5d4', '#f8e231', '#7c3aed', '#38bdf8', '#f97316'];

  return (
    <section className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <h2 className="text-xl font-bold">Daily alarms</h2>
        </CardHeader>
        <CardContent>
          {isTrendLoading ? (
            <StateBlock state="loading" title="Loading alarm trend" />
          ) : isTrendError || trendData.length === 0 ? (
            <StateBlock title="No trend data" description="Try another time range or filter." />
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
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatNumberWithSuffix} />
                  <Tooltip {...darkTooltipProps} formatter={(value: any) => [formatNumberWithSuffix(Number(value)), 'Count']} />
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
          <h2 className="text-xl font-bold">Severity split</h2>
        </CardHeader>
        <CardContent>
          {isSeverityLoading ? (
            <StateBlock state="loading" title="Loading severity" />
          ) : isSeverityError || severityData.length === 0 ? (
            <StateBlock title="No severity data" description="No severity groups returned." />
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
                    outerRadius={80}
                    paddingAngle={1}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-mono text-muted">{value}</span>}
                  />
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
  const weeklyData = getSortedTrendRows(trend ?? []).slice(-7).map((row) => ({
    name: rowLabel(row).slice(0, 3).toUpperCase(),
    value: row.value,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Weekly alarms</h2>
          <MoreDots />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StateBlock state="loading" title="Loading weekly alarms" />
        ) : isError || weeklyData.length === 0 ? (
          <StateBlock title="No weekly data" description="No weekly alarm groups returned." />
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
  return <span className="font-mono text-lg leading-none text-muted">•••</span>;
}
