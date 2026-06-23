import { useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { Button } from '../components/ui/Button';
import { DashboardWidget } from '../features/dashboard/components/DashboardWidget';
import { GeneralSettingsDrawer } from '../features/dashboard/components/GeneralSettingsDrawer';
import {
  WidgetSettingsDrawer,
  type WidgetSettingsValues,
} from '../features/dashboard/components/WidgetSettingsDrawer';

type WidgetType =
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

interface WidgetConfig extends WidgetSettingsValues {
  id: string;
  title: string;
  type: WidgetType;
  layoutOrder: number;
  layoutSpan: 1 | 2;
}

type TableHeightMode = 'paired' | 'middle' | 'roomy';

export function DashboardPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    {
      id: 'kpi-1',
      type: 'kpi-count',
      title: 'Alarm count',
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
      title: 'Affected devices',
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
      title: 'Current status',
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
      title: 'Daily alarms',
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
      title: 'Severity split',
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
      title: 'Weekly alarms',
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
      title: 'Alarm heatmap',
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
      title: 'Alarm list',
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
      title: 'Devices by region',
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
  const [activeTemplate, setActiveTemplate] = useState<{ id: string; name: string } | null>(null);

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
    setActiveTemplate(null);
    setWidgets((prev) =>
      prev.map((w) => (w.id === activeWidgetId ? { ...w, ...newValues } : w))
    );
  }

  function getLayoutContext(widget: WidgetConfig, index: number) {
    const previousWidget = visibleLayoutWidgets[index - 1];
    const nextWidget = visibleLayoutWidgets[index + 1];
    const isLastVisibleWidget = index === visibleLayoutWidgets.length - 1;
    const hasRowMate =
      widget.layoutSpan === 1 &&
      (previousWidget?.layoutSpan === 1 || nextWidget?.layoutSpan === 1);

    const tableHeightMode: TableHeightMode =
      widget.chartType !== 'table'
        ? 'middle'
        : widget.layoutSpan === 2 || (isLastVisibleWidget && !hasRowMate)
          ? 'roomy'
          : hasRowMate
            ? 'paired'
            : 'middle';

    return {
      isLastVisibleWidget,
      hasRowMate,
      tableHeightMode,
    };
  }

  return (
    <PageShell>
      <PageHeader
        title="Alarm"
        accent="dashboard"
        description="Monitor alarm health, trends, severity, and operational hotspots from a customizable dashboard."
        action={
          <Button
            variant="secondary"
            className="h-12 px-5 font-mono font-bold"
            onClick={() => setGeneralSettingsOpen(true)}
          >
            <PenLine size={18} />
            Customize
          </Button>
        }
      />

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

      <div className="grid grid-cols-1 gap-6 lg:grid-flow-dense lg:grid-cols-2">
        {visibleLayoutWidgets.map((w, index) => (
          <div key={w.id} className={w.layoutSpan === 2 ? 'lg:col-span-2' : undefined}>
          <DashboardWidget
            id={w.id}
            config={w}
            layoutContext={getLayoutContext(w, index)}
            onSettingsClick={() => setActiveWidgetId(w.id)}
          />
          </div>
        ))}
      </div>

      <GeneralSettingsDrawer
        isOpen={generalSettingsOpen}
        widgets={widgets}
        activeTemplate={activeTemplate}
        onClose={() => setGeneralSettingsOpen(false)}
        onSave={setWidgets}
        onTemplateChange={setActiveTemplate}
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
        />
      )}
    </PageShell>
  );
}
