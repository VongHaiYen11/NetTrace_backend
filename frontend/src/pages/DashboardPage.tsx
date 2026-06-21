import { useMemo } from 'react';
import { PenLine } from 'lucide-react';
import { KpiGrid } from '../features/dashboard/components/KpiGrid';
import { AnalyticsCharts, WeeklyAlarmChart } from '../features/dashboard/components/AnalyticsCharts';
import { WeekdayHeatmap } from '../features/dashboard/components/WeekdayHeatmap';
import { AlarmTable } from '../features/dashboard/components/AlarmTable';
import { Button } from '../components/ui/Button';
import { useDashboardData } from '../features/dashboard/hooks/useDashboardData';
import type { CommonFilters, WeekdayHeatmapCell } from '../services/generated/nettrace-api';

export function DashboardPage() {
  const filters = useMemo<CommonFilters>(
    () => ({
      from_time: '2026-06-01',
      to_time: '2026-06-30',
    }),
    [],
  );
  const data = useDashboardData(filters);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mt-3 text-5xl font-black leading-tight sm:text-6xl">
            Bảng điều khiển <span className="text-[#00f5d4]">cảnh báo</span>
          </h1>
        </div>
        <Button variant="secondary" className="h-12 px-5 font-mono font-bold">
          <PenLine size={18} />
          Chọn mẫu
        </Button>
      </div>

      <KpiGrid
        data={data.summary.data?.data}
        isLoading={data.summary.isLoading}
        isError={data.summary.isError}
      />

      <AnalyticsCharts
        trend={data.trend.data?.data}
        severity={data.severity.data?.data}
        isTrendLoading={data.trend.isLoading}
        isSeverityLoading={data.severity.isLoading}
        isTrendError={data.trend.isError}
        isSeverityError={data.severity.isError}
      />

      <section className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <WeeklyAlarmChart
            trend={data.trend.data?.data}
            isLoading={data.trend.isLoading}
            isError={data.trend.isError}
          />
        </div>
        <div className="xl:col-span-3">
          <WeekdayHeatmap
            data={data.heatmap.data?.data as WeekdayHeatmapCell[] | undefined}
            isLoading={data.heatmap.isLoading}
            isError={data.heatmap.isError}
          />
        </div>
      </section>

      <AlarmTable
        data={data.alarms.data?.data}
        isLoading={data.alarms.isLoading}
        isError={data.alarms.isError}
      />
    </div>
  );
}
