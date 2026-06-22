import { useState, useMemo } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardWidget } from '../features/dashboard/components/DashboardWidget';
import { GeneralSettingsDrawer } from '../features/dashboard/components/GeneralSettingsDrawer';
import {
  WidgetSettingsDrawer,
  type WidgetSettingsValues,
} from '../features/dashboard/components/WidgetSettingsDrawer';

type WidgetType =
  | 'kpi-count'
  | 'kpi-devices'
  | 'kpi-status'
  | 'chart-trend'
  | 'chart-severity'
  | 'chart-weekly'
  | 'chart-heatmap'
  | 'chart-extra'
  | 'table-alarms';

interface WidgetConfig extends WidgetSettingsValues {
  id: string;
  title: string;
  type: WidgetType;
  layoutOrder: number;
  layoutSpan: 1 | 2;
}

export function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      id: 'kpi-1',
      type: 'kpi-count',
      title: 'Số lượng cảnh báo',
      layoutOrder: 0,
      layoutSpan: 1,
      visible: true,
      chartType: 'line',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'kpi-2',
      type: 'kpi-devices',
      title: 'Thiết bị bị ảnh hưởng',
      layoutOrder: 0,
      layoutSpan: 1,
      visible: true,
      chartType: 'bar',
      metric: 'affected_devices',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'kpi-3',
      type: 'kpi-status',
      title: 'Trạng thái hiện tại',
      layoutOrder: 0,
      layoutSpan: 1,
      visible: true,
      chartType: 'pie',
      metric: 'count',
      groupBy: 'severity',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-1',
      type: 'chart-trend',
      title: 'Cảnh báo theo ngày',
      layoutOrder: 1,
      layoutSpan: 2,
      visible: true,
      chartType: 'line',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-2',
      type: 'chart-severity',
      title: 'Phân bố mức độ',
      layoutOrder: 2,
      layoutSpan: 1,
      visible: true,
      chartType: 'pie',
      metric: 'count',
      groupBy: 'severity',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-3',
      type: 'chart-weekly',
      title: 'Cảnh báo (tuần này)',
      layoutOrder: 3,
      layoutSpan: 1,
      visible: true,
      chartType: 'bar',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'week',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-4',
      type: 'chart-heatmap',
      title: 'Bản đồ nhiệt',
      layoutOrder: 4,
      layoutSpan: 2,
      visible: true,
      chartType: 'heatmap',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: false,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'table-1',
      type: 'table-alarms',
      title: 'Danh sách cảnh báo',
      layoutOrder: 5,
      layoutSpan: 2,
      visible: true,
      chartType: 'table',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-5',
      type: 'chart-extra',
      title: 'Thiết bị theo khu vực',
      layoutOrder: 6,
      layoutSpan: 1,
      visible: false,
      chartType: 'bar',
      metric: 'affected_devices',
      groupBy: 'province',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
  ]);

  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);

  const activeWidget = useMemo(() => {
    return widgets.find((w) => w.id === activeWidgetId);
  }, [widgets, activeWidgetId]);

  const kpiWidgets = useMemo(
    () => widgets.filter((widget) => widget.type.startsWith('kpi') && widget.visible),
    [widgets],
  );

  const visibleLayoutWidgets = useMemo(
    () =>
      widgets
        .filter((widget) => !widget.type.startsWith('kpi') && widget.visible)
        .sort((a, b) => a.layoutOrder - b.layoutOrder),
    [widgets],
  );

  function handleApplySettings(newValues: WidgetSettingsValues) {
    if (!activeWidgetId) return;
    setWidgets((prev) =>
      prev.map((w) => (w.id === activeWidgetId ? { ...w, ...newValues } : w))
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mt-3 text-5xl font-black leading-tight sm:text-6xl">
            Bảng điều khiển <span className="text-[#00f5d4]">cảnh báo</span>
          </h1>
        </div>
        <Button
          variant="secondary"
          className="h-12 px-5 font-mono font-bold"
          onClick={() => setGeneralSettingsOpen(true)}
        >
          <PenLine size={18} />
          Tùy chỉnh
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {kpiWidgets.map((w) => (
          <DashboardWidget
            key={w.id}
            id={w.id}
            config={w}
            onSettingsClick={() => setActiveWidgetId(w.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {visibleLayoutWidgets.map((w) => (
          <div key={w.id} className={w.layoutSpan === 2 ? 'lg:col-span-2' : undefined}>
          <DashboardWidget
            id={w.id}
            config={w}
            onSettingsClick={() => setActiveWidgetId(w.id)}
          />
          </div>
        ))}
      </div>

      <GeneralSettingsDrawer
        isOpen={generalSettingsOpen}
        widgets={widgets}
        onClose={() => setGeneralSettingsOpen(false)}
        onSave={setWidgets}
      />

      {/* Settings Drawer */}
      {activeWidget && (
        <WidgetSettingsDrawer
          isOpen={activeWidgetId !== null}
          onClose={() => setActiveWidgetId(null)}
          onApply={handleApplySettings}
          initialValues={activeWidget}
          widgetTitle={activeWidget.title}
          widgetKind={activeWidget.type}
          activeWidgetId={activeWidget.id}
          availableWidgets={widgets.map((widget) => ({
            id: widget.id,
            title: widget.title,
            visible: widget.visible,
          }))}
          onWidgetChange={setActiveWidgetId}
        />
      )}
    </div>
  );
}
