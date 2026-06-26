import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { Button } from '../components/ui/Button';
import { DashboardWidget } from '../features/dashboard/components/DashboardWidget';
import {
  buildTemplateSnapshot,
  buildTemplateWidgetInputs,
  GeneralSettingsDrawer,
  getLayoutCapacity,
} from '../features/dashboard/components/GeneralSettingsDrawer';
import {
  WidgetSettingsDrawer,
  type WidgetPresetOption,
  type WidgetSettingsValues,
} from '../features/dashboard/components/WidgetSettingsDrawer';
import { nettraceApi } from '../services/generated/nettrace-api';
import { decodeTableColumns } from '../utils/columns';
import type { AppOutletContext } from '../layouts/AppLayout';

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
  const queryClient = useQueryClient();
  const {
    dashboardWidgets,
    setDashboardWidgets,
    activeTemplate,
    setActiveTemplate,
  } = useOutletContext<AppOutletContext>();
  const widgets = dashboardWidgets as WidgetConfig[];
  const setWidgets = setDashboardWidgets;

  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);

function normalizePresetChartType(value: string | null | undefined): 'line' | 'bar' | 'pie' | 'table' | 'heatmap' {
  if (value === 'line' || value === 'bar' || value === 'pie' || value === 'table' || value === 'heatmap') {
    return value;
  }
  return 'line';
}

function normalizePresetMetric(value: string | null | undefined) {
  if (value === 'count' || value === 'avg_duration' || value === 'max_duration' || value === 'affected_devices') {
    return value;
  }
  return 'count';
}

function normalizePresetGroupBy(value: string | null | undefined) {
  if (value === 'none') return 'none';
  if (
    value === 'severity' ||
    value === 'status' ||
    value === 'error_code' ||
    value === 'device' ||
    value === 'device_type' ||
    value === 'vendor' ||
    value === 'station' ||
    value === 'province'
  ) {
    return value;
  }
  return 'none';
}

function normalizePresetTimeBucket(value: string | null | undefined) {
  if (value === 'hour' || value === 'day' || value === 'week' || value === 'month' || value === 'year') {
    return value;
  }
  return 'day';
}

function normalizePresetHeatmapMode(value: string | null | undefined) {
  if (value === 'weekday' || value === 'calendar') {
    return value;
  }
  return 'weekday';
}

function normalizePresetTableColumns(value: string | null | undefined) {
  return decodeTableColumns(value);
}

  const widgetPresets = useQuery({
    queryKey: ['dashboard-widget-presets'],
    queryFn: async () => {
      const templates = await nettraceApi.listTemplates({ limit: 50, offset: 0 });
      const presets = await nettraceApi.listPresets({ limit: 1000, offset: 0 });
      const options: WidgetPresetOption[] = presets.data.map((preset) => {
        const chartType = normalizePresetChartType(preset.chart_type);
        return {
          id: `preset:${preset.preset_id}`,
          label: `${preset.preset_name ?? `Preset ${preset.preset_id}`} · ${preset.template_name ?? 'Unassigned'}`,
          values: {
            title: preset.preset_name || `Preset ${preset.preset_id}`,
            visible: true,
            chartType,
            metric: normalizePresetMetric(preset.status) as any,
            groupBy: normalizePresetGroupBy(preset.severity) as any,
            timeBucket: normalizePresetTimeBucket(preset.error_code) as any,
            heatmapMode: normalizePresetHeatmapMode(preset.vendor) as any,
            tableColumns: normalizePresetTableColumns(preset.device_type),
            info1: true,
            info2: true,
            info3: true,
            preset: `preset:${preset.preset_id}`,
            startDate: preset.start_date?.slice(0, 10) ?? '',
            endDate: preset.end_date?.slice(0, 10) ?? '',
          },
        };
      });

      return {
        options,
        templateIds: templates.data.map((template) => template.template_id),
      };
    },
    refetchOnWindowFocus: true,
    refetchInterval: activeTemplate ? 10_000 : false,
  });

  useEffect(() => {
    if (!activeTemplate || !widgetPresets.data) return;
    const templateId = activeTemplate.id.startsWith('db:')
      ? Number(activeTemplate.id.replace('db:', ''))
      : null;
    if (templateId && !widgetPresets.data.templateIds.includes(templateId)) {
      setActiveTemplate(null);
      setWidgets([]);
      setActiveWidgetId(null);
      setGeneralSettingsOpen(false);
      toast.info('The selected template no longer exists.');
    }
  }, [activeTemplate, widgetPresets.data]);

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

  async function handleApplySettings(newValues: WidgetSettingsValues) {
    if (!activeWidgetId) return;
    const currentTemplate = activeTemplate;
    const templateId = currentTemplate?.id.startsWith('db:')
      ? Number(currentTemplate.id.replace('db:', ''))
      : null;
    if (!templateId || !currentTemplate) return;

    const nextWidgets = widgets.map((widget) =>
      widget.id === activeWidgetId ? { ...widget, ...newValues } : widget,
    );

    try {
      await nettraceApi.updateTemplate(templateId, {
        name: currentTemplate.name,
        selected_cards: buildTemplateSnapshot(nextWidgets, getLayoutCapacity(nextWidgets)),
        widgets: buildTemplateWidgetInputs(nextWidgets),
      });
      setWidgets(nextWidgets);
      toast.success('Widget and template updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the template.');
    }
  }

  function handleTemplateChange(template: { id: string; name: string } | null) {
    if (template?.id.startsWith('db:')) {
      const templateId = Number(template.id.replace('db:', ''));
      if (Number.isFinite(templateId)) {
        queryClient.setQueryData<{
          options: WidgetPresetOption[];
          templateIds: number[];
        }>(['dashboard-widget-presets'], (current) =>
          current
            ? {
                ...current,
                templateIds: current.templateIds.includes(templateId)
                  ? current.templateIds
                  : [...current.templateIds, templateId],
              }
            : current,
        );
      }
    }
    setActiveTemplate(template);
    void queryClient.invalidateQueries({ queryKey: ['dashboard-widget-presets'] });
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

      {!activeTemplate ? (
        <div className="rounded border border-dashed border-border bg-panel-light px-6 py-16 text-center">
          <p className="font-mono text-lg font-black text-light">No template selected</p>
          <p className="mt-2 text-sm text-muted">Choose a template to begin.</p>
        </div>
      ) : null}

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
        onTemplateChange={handleTemplateChange}
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
          presets={widgetPresets.data?.options ?? []}
        />
      )}
    </PageShell>
  );
}
