import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PieChart,
  RadioTower,
  Search,
  Table,
  TrendingUp,
  Type as TypeIcon,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import { cn } from '../../../utils/cn';
import type { WidgetKind, WidgetSettingsValues } from './WidgetSettingsDrawer';

type DashboardWidgetConfig = WidgetSettingsValues & {
  id: string;
  title: string;
  type: WidgetKind;
  layoutOrder: number;
  layoutSpan: 1 | 2;
};

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  layoutCount: 2 | 4 | 6;
  apply: (widgets: DashboardWidgetConfig[]) => DashboardWidgetConfig[];
}

interface GeneralSettingsDrawerProps {
  isOpen: boolean;
  widgets: DashboardWidgetConfig[];
  onClose: () => void;
  onSave: (widgets: DashboardWidgetConfig[]) => void;
}

const summaryOptions = [
  {
    key: 'kpi-count',
    icon: RadioTower,
    title: 'Alarm count',
    fields: ['totalAlarms', 'activeAlarms', 'closedAlarms'],
    description: 'Shows total, active, and closed alarms.',
  },
  {
    key: 'kpi-devices',
    icon: TrendingUp,
    title: 'Affected devices',
    fields: ['affectedDevices'],
    description: 'Shows the unique affected device count.',
  },
  {
    key: 'kpi-status',
    icon: AlertTriangle,
    title: 'Critical alarms',
    fields: ['criticalAlarms'],
    description: 'Shows status and critical alarm count.',
  },
] as const;

type KpiWidgetKind = (typeof summaryOptions)[number]['key'];

const informationScenarios = [
  { value: 'count', label: 'Alarm count' },
  { value: 'avg_duration', label: 'Avg handling time' },
  { value: 'max_duration', label: 'Max handling time' },
  { value: 'affected_devices', label: 'Affected devices' },
] as const;

const groupScenarios = [
  { value: 'none', label: 'No group' },
  { value: 'severity', label: 'Severity' },
  { value: 'status', label: 'Status' },
  { value: 'error_code', label: 'Error code' },
  { value: 'device', label: 'Device' },
  { value: 'device_type', label: 'Device type' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'station', label: 'Station' },
  { value: 'province', label: 'Province' },
] as const;

const timeBucketOptions = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
] as const;

const heatmapModeOptions = [
  { value: 'weekday', label: 'Weekday heatmap' },
  { value: 'calendar', label: 'Year heatmap' },
] as const;

const chartTypeOptions = [
  { value: 'line', label: 'Line chart', icon: TrendingUp },
  { value: 'bar', label: 'Bar chart', icon: BarChart3 },
  { value: 'pie', label: 'Pie chart', icon: PieChart },
  { value: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
  { value: 'table', label: 'Data table', icon: Table },
] as const;

function getDisplayOptions(widget: DashboardWidgetConfig) {
  if (widget.chartType === 'table') {
    return [
      { key: 'info1', label: 'Time column', checked: widget.info1 },
      { key: 'info2', label: 'Error code column', checked: widget.info2 },
      { key: 'info3', label: 'Status column', checked: widget.info3 },
    ] as const;
  }
  if (widget.chartType === 'heatmap') {
    return [
      { key: 'info1', label: 'Hover tooltip', checked: widget.info1 },
      { key: 'info2', label: 'Time / date labels', checked: widget.info2 },
    ] as const;
  }
  if (widget.chartType === 'pie') {
    return [
      { key: 'info1', label: 'Hover tooltip', checked: widget.info1 },
      { key: 'info2', label: 'Group labels', checked: widget.info2 },
    ] as const;
  }
  return [
    { key: 'info1', label: 'Grid', checked: widget.info1 },
    { key: 'info2', label: 'Value axis', checked: widget.info2 },
    { key: 'info3', label: 'Hover tooltip', checked: widget.info3 },
  ] as const;
}

function normalizeChartPatch(
  chartType: WidgetSettingsValues['chartType'],
  current: DashboardWidgetConfig,
): Partial<DashboardWidgetConfig> {
  if (chartType === 'line') return { chartType, groupBy: 'none', layoutSpan: current.id === 'chart-1' ? 2 : current.layoutSpan };
  if (chartType === 'bar') return { chartType };
  if (chartType === 'pie') {
    return { chartType, groupBy: current.groupBy === 'none' ? 'severity' : current.groupBy };
  }
  if (chartType === 'heatmap') {
    return { chartType, groupBy: 'none', heatmapMode: current.heatmapMode ?? 'weekday', layoutSpan: 2 };
  }
  return { chartType, groupBy: 'none', layoutSpan: 2 };
}

function withVisibleChartCount(widgets: DashboardWidgetConfig[], count: 2 | 4 | 6) {
  const orderedIds = getChartWidgets(widgets).map((widget) => widget.id);
  return widgets.map((widget) => {
    if (widget.type.startsWith('kpi')) return widget;
    const visibleIndex = orderedIds.indexOf(widget.id) + 1;
    return { ...widget, visible: visibleIndex <= count };
  });
}

function updateWidget(
  widgets: DashboardWidgetConfig[],
  widgetId: string,
  patch: Partial<DashboardWidgetConfig>,
) {
  return widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...patch } : widget));
}

function updateKpiContent(
  widgets: DashboardWidgetConfig[],
  widgetId: string,
  nextType: KpiWidgetKind,
) {
  const option = summaryOptions.find((item) => item.key === nextType);
  return updateWidget(widgets, widgetId, {
    type: nextType,
    title: option?.title ?? 'KPI Card',
  });
}

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getYearFromDate(value: string) {
  return value?.slice(0, 4) || String(new Date().getFullYear());
}

function getYearDateRange(yearValue: string) {
  const year = Number(yearValue) || new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: year === currentYear ? getCurrentIsoDate() : `${year}-12-31`,
  };
}

function getChartWidgets(widgets: DashboardWidgetConfig[]) {
  return widgets
    .filter((widget) => !widget.type.startsWith('kpi'))
    .sort((a, b) => a.layoutOrder - b.layoutOrder);
}

function getVisibleChartWidgets(widgets: DashboardWidgetConfig[]) {
  return getChartWidgets(widgets).filter((widget) => widget.visible);
}

function getHiddenChartWidgets(widgets: DashboardWidgetConfig[]) {
  return getChartWidgets(widgets).filter((widget) => !widget.visible);
}

function compactVisibleChartOrder(widgets: DashboardWidgetConfig[]) {
  const visibleCharts = getVisibleChartWidgets(widgets);
  const orderById = new Map(visibleCharts.map((widget, index) => [widget.id, index + 1]));
  return widgets.map((widget) => {
    const nextOrder = orderById.get(widget.id);
    return nextOrder ? { ...widget, layoutOrder: nextOrder } : widget;
  });
}

function getLayoutCapacity(widgets: DashboardWidgetConfig[]) {
  const visibleCount = getVisibleChartWidgets(widgets).length;
  if (visibleCount <= 2) return 2;
  if (visibleCount <= 4) return 4;
  return 6;
}

function hideChartWidget(widgets: DashboardWidgetConfig[], widgetId: string) {
  return compactVisibleChartOrder(
    widgets.map((widget) => (widget.id === widgetId ? { ...widget, visible: false } : widget)),
  );
}

function restoreChartWidget(widgets: DashboardWidgetConfig[], widgetId: string, slot?: number) {
  const compacted = compactVisibleChartOrder(widgets);
  const visibleCharts = getVisibleChartWidgets(compacted);
  const targetSlot = slot ?? visibleCharts.length + 1;

  return compacted.map((widget) => {
    if (widget.type.startsWith('kpi')) return widget;
    if (widget.id === widgetId) {
      return { ...widget, visible: true, layoutOrder: targetSlot };
    }
    if (widget.visible && widget.layoutOrder >= targetSlot) {
      return { ...widget, layoutOrder: widget.layoutOrder + 1 };
    }
    return widget;
  });
}

const templates: DashboardTemplate[] = [
  {
    id: 'operations',
    name: 'Network ops',
    description: 'SYS_MON / TELEMETRY',
    layoutCount: 4,
    apply: (widgets) =>
      withVisibleChartCount(widgets, 4).map((widget) => {
        if (widget.id === 'chart-1') return { ...widget, chartType: 'line', metric: 'count', groupBy: 'none', timeBucket: 'day', layoutSpan: 2 };
        if (widget.id === 'chart-2') return { ...widget, chartType: 'pie', metric: 'count', groupBy: 'severity' };
        if (widget.id === 'chart-3') return { ...widget, chartType: 'bar', metric: 'count', groupBy: 'none', timeBucket: 'week' };
        if (widget.id === 'chart-4') return { ...widget, chartType: 'heatmap', metric: 'count', groupBy: 'none', heatmapMode: 'weekday', layoutSpan: 2 };
        return widget;
      }),
  },
  {
    id: 'critical',
    name: 'Security audit',
    description: 'LOG_VIEW / ALERTS',
    layoutCount: 2,
    apply: (widgets) =>
      withVisibleChartCount(widgets, 2).map((widget) => {
        if (widget.id === 'chart-1') return { ...widget, chartType: 'bar', metric: 'count', groupBy: 'severity', layoutSpan: 1 };
        if (widget.id === 'chart-2') return { ...widget, chartType: 'pie', metric: 'count', groupBy: 'status' };
        return widget;
      }),
  },
  {
    id: 'full',
    name: 'User telemetry',
    description: 'DATA_VIZ / METRICS',
    layoutCount: 6,
    apply: (widgets) =>
      withVisibleChartCount(widgets, 6).map((widget) => {
        if (widget.id === 'chart-5') return { ...widget, chartType: 'bar', metric: 'affected_devices', groupBy: 'province', visible: true, layoutSpan: 1 };
        if (widget.id === 'table-1') return { ...widget, chartType: 'table', visible: true, layoutSpan: 2 };
        return widget;
      }),
  },
];

const extraTemplate = {
  id: 'terminal',
  name: 'Terminal focus',
  description: 'CLI / RAW_DATA',
};

function getVisibleChartCount(widgets: DashboardWidgetConfig[]) {
  const count = widgets.filter((widget) => !widget.type.startsWith('kpi') && widget.visible).length;
  if (count <= 2) return 2;
  if (count <= 4) return 4;
  return 6;
}

function getLayoutCountLabel(count: number) {
  return `${count}-widget layout`;
}

function formatDisplayDate(value: string) {
  if (!value) return 'Not set';
  return value;
}

function getDefaultWidgetTitle(widget: DashboardWidgetConfig) {
  const dataLabel =
    widget.chartType === 'table'
      ? 'Alarm table'
      : widget.chartType === 'heatmap'
        ? 'Alarm heatmap'
        : informationScenarios.find((option) => option.value === widget.metric)?.label ?? 'Widget';

  return `${dataLabel} · ${formatDisplayDate(widget.startDate)} - ${formatDisplayDate(widget.endDate)}`;
}

function normalizeWidgetTitle(widget: DashboardWidgetConfig) {
  return {
    ...widget,
    title: widget.title.trim() || getDefaultWidgetTitle(widget),
  };
}

export function GeneralSettingsDrawer({
  isOpen,
  widgets,
  onClose,
  onSave,
}: GeneralSettingsDrawerProps) {
  const [draftWidgets, setDraftWidgets] = useState(widgets);
  const [detailDraftWidgets, setDetailDraftWidgets] = useState(widgets);
  const [selectedTemplateId, setSelectedTemplateId] = useState('none');
  const [templateSearch, setTemplateSearch] = useState('');
  const [dashboardStatusOpen, setDashboardStatusOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailStep, setDetailStep] = useState<'template' | 'widget'>('template');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [restoreWidgetId, setRestoreWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftWidgets(widgets);
      setDetailDraftWidgets(widgets);
      setSelectedTemplateId('none');
      setTemplateSearch('');
      setDashboardStatusOpen(false);
      setTemplateDropdownOpen(false);
      setDetailModalOpen(false);
      setDetailStep('template');
      setSelectedSlotId(null);
      setRestoreWidgetId(null);
    }
  }, [isOpen, widgets]);

  const layoutCount = useMemo(() => getLayoutCapacity(detailDraftWidgets), [detailDraftWidgets]);
  const kpiWidgets = detailDraftWidgets.filter((widget) => widget.type.startsWith('kpi'));
  const sidebarKpiWidgets = draftWidgets.filter((widget) => widget.type.startsWith('kpi'));
  const chartWidgets = getChartWidgets(detailDraftWidgets);
  const visibleChartWidgets = getVisibleChartWidgets(detailDraftWidgets);
  const hiddenChartWidgets = getHiddenChartWidgets(detailDraftWidgets);
  const sidebarVisibleCharts = getVisibleChartWidgets(draftWidgets);
  const sidebarHiddenCharts = getHiddenChartWidgets(draftWidgets);
  const sidebarLayoutCount = getLayoutCapacity(draftWidgets);
  const sidebarEmptySlots = Array.from(
    { length: Math.max(0, sidebarLayoutCount - sidebarVisibleCharts.length) },
    (_, index) => sidebarVisibleCharts.length + index + 1,
  );
  const selectedSlot = chartWidgets.find((widget) => widget.id === selectedSlotId) ?? visibleChartWidgets[0] ?? chartWidgets[0];
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const filteredTemplates = templates.filter((template) =>
    `${template.name} ${template.description}`.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  if (!isOpen) return null;

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setRestoreWidgetId(null);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setDraftWidgets(widgets);
      return;
    }
    setDraftWidgets(template.apply(widgets));
  }

  function applyLayoutCount(count: 2 | 4 | 6) {
    setSelectedTemplateId('none');
    setDetailDraftWidgets((current) => withVisibleChartCount(current, count));
  }

  function hideSidebarWidget(widgetId: string) {
    setSelectedTemplateId('none');
    setRestoreWidgetId(null);
    setDraftWidgets((current) => hideChartWidget(current, widgetId));
  }

  function startRestoreSidebarWidget(widgetId: string) {
    setSelectedTemplateId('none');
    setRestoreWidgetId(widgetId);
  }

  function restoreSidebarWidget(widgetId: string, slot?: number) {
    setSelectedTemplateId('none');
    setDraftWidgets((current) => restoreChartWidget(current, widgetId, slot));
    setRestoreWidgetId(null);
  }

  function toggleSidebarKpi(widgetId: string) {
    setSelectedTemplateId('none');
    setDraftWidgets((current) =>
      current.map((widget) => (widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget)),
    );
  }

  function toggleKpi(widgetId: string) {
    setSelectedTemplateId('none');
    setDetailDraftWidgets((current) =>
      current.map((widget) => (widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget)),
    );
  }

  function saveAndClose() {
    onSave(draftWidgets.map(normalizeWidgetTitle));
    onClose();
  }

  function openDetailModal() {
    setDetailDraftWidgets(draftWidgets);
    setSelectedSlotId(getVisibleChartWidgets(draftWidgets)[0]?.id ?? getChartWidgets(draftWidgets)[0]?.id ?? null);
    setDetailStep('template');
    setDetailModalOpen(true);
  }

  function saveDetailDraft() {
    setDraftWidgets(detailDraftWidgets.map(normalizeWidgetTitle));
    setSelectedTemplateId('none');
    setDetailModalOpen(false);
  }

  function renderTemplatePreview(templateId: string) {
    const highlight = selectedTemplateId === templateId;
    return (
      <div className="grid h-20 grid-cols-2 gap-px border border-[#2b2740] bg-[#0c0b14] p-1">
        <span className={cn('bg-[#1b1930]', highlight && 'bg-[#5b1738]')} />
        <span className="bg-[#1b1930]" />
        <span className="bg-[#151421]" />
        <span className="bg-[#151421]" />
      </div>
    );
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
    setDetailStep('template');
  }

  function goToWidgetStep() {
    setSelectedSlotId((current) => current ?? visibleChartWidgets[0]?.id ?? chartWidgets[0]?.id ?? null);
    setDetailStep('widget');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <h2 className="text-2xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.7)]">
            Customize dashboard
          </h2>
          <button className="rounded p-1.5 text-[#ff2d85] hover:bg-[#ff2d85]/10" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left border border-[#00f5d4]/35 bg-[#101923] p-4 shadow-[0_0_18px_rgba(0,245,212,0.08)]"
              onClick={() => setDashboardStatusOpen((value) => !value)}
            >
              <span>
                <span className="block font-mono text-lg font-black text-[#00f5d4] drop-shadow-[0_0_8px_rgba(0,245,212,0.45)]">
                  Dashboard status
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-[#a69db6]">
                  Review the current layout and toggle widgets.
                </span>
              </span>
              {dashboardStatusOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-[#00f5d4]" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-[#00f5d4]" size={20} />
              )}
            </button>

            {dashboardStatusOpen ? (
              <div className="space-y-5 px-1 pb-2">
                <div>
                  <p className="font-mono text-base font-black text-[#f3edff]">
                    Current state
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-[#191727] p-3 rounded">
                      <p className="font-mono text-[11px] text-[#a69db6]">Layout</p>
                      <p className="mt-1 font-mono text-sm font-black text-[#f3edff]">
                        {getLayoutCountLabel(sidebarLayoutCount)}
                      </p>
                    </div>
                    <div className="bg-[#191727] p-3 rounded">
                      <p className="font-mono text-[11px] text-[#a69db6]">Visible</p>
                      <p className="mt-1 font-mono text-sm font-black text-[#f3edff]">
                        {sidebarVisibleCharts.length}/{getChartWidgets(draftWidgets).length} widget
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-base font-black text-[#f3edff]">Card KPI</p>
                    <span className="font-mono text-xs text-[#a69db6]">
                      {sidebarKpiWidgets.filter((widget) => widget.visible).length}/{sidebarKpiWidgets.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {sidebarKpiWidgets.map((widget) => {
                      const option = summaryOptions.find((item) => item.key === widget.type);
                      const Icon = option?.icon ?? Activity;
                      return (
                        <div
                          key={widget.id}
                          className="flex items-center justify-between gap-3 border-b border-white/5 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon size={16} className={widget.visible ? 'text-[#00f5d4]' : 'text-[#777086]'} />
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm font-bold text-[#f3edff]">{option?.title ?? widget.title}</p>
                              <p className="font-mono text-[11px] text-[#a69db6]">
                                {widget.visible ? 'Visible' : 'Hidden'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            title={widget.visible ? 'Hide KPI card' : 'Show KPI card'}
                            onClick={() => toggleSidebarKpi(widget.id)}
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded border transition',
                              widget.visible
                                ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] hover:bg-[#00f5d4]/15'
                                : 'border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85] hover:bg-[#ff2d85]/15',
                            )}
                          >
                            {widget.visible ? <Eye size={17} /> : <EyeOff size={17} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-base font-black text-[#f3edff]">Visible widgets</p>
                    <span className="font-mono text-xs text-[#a69db6]">{sidebarVisibleCharts.length}/{getChartWidgets(draftWidgets).length}</span>
                  </div>
                  <div className="space-y-2">
                    {sidebarVisibleCharts.map((widget) => (
                      <div
                        key={widget.id}
                        className="flex items-center justify-between gap-3 border-b border-white/5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-[#f3edff]">{widget.title}</p>
                          <p className="font-mono text-[11px] text-[#a69db6]">
                            Slot {widget.layoutOrder} · {widget.layoutSpan === 2 ? '2 desktop cells' : '1 cell'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            title={widget.layoutSpan === 2 ? 'Full width. Click for half width.' : 'Half width. Click for full width.'}
                            onClick={() => {
                              setSelectedTemplateId('none');
                              setDraftWidgets((current) =>
                                updateWidget(current, widget.id, {
                                  layoutSpan: widget.layoutSpan === 2 ? 1 : 2,
                                })
                              );
                            }}
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded border transition',
                              widget.layoutSpan === 2
                                ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] shadow-[0_0_16px_rgba(0,245,212,0.25)]'
                                : 'border-[#2b2740] bg-[#151421] text-[#a69db6] hover:border-[#ff2d85]/60 hover:text-[#f3edff]'
                            )}
                          >
                            {widget.layoutSpan === 2 ? (
                              <Minimize2 size={15} />
                            ) : (
                              <Maximize2 size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Hide widget"
                            onClick={() => hideSidebarWidget(widget.id)}
                            className="flex h-9 w-9 items-center justify-center rounded border border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] transition hover:bg-[#00f5d4]/15"
                          >
                            <Eye size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-mono text-base font-black text-[#f3edff]">Hidden widgets</p>
                  {sidebarHiddenCharts.length > 0 ? (
                    <div className="space-y-2">
                      {sidebarHiddenCharts.map((widget) => {
                        const isRestoring = restoreWidgetId === widget.id;
                        return (
                          <div
                            key={widget.id}
                            className="border-b border-white/5 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-sm font-bold text-[#f3edff]">{widget.title}</p>
                                <p className="font-mono text-[11px] text-[#a69db6]">
                                  {widget.layoutSpan === 2 ? 'Prefers 2 desktop cells' : 'Prefers 1 cell'}
                                </p>
                              </div>
                              <button
                                type="button"
                                title="Restore widget"
                                onClick={() => startRestoreSidebarWidget(widget.id)}
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded border transition",
                                  isRestoring
                                    ? "border-[#ff2d85] bg-[#ff2d85]/20 text-[#ff2d85]"
                                    : "border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85] hover:bg-[#ff2d85]/15"
                                )}
                              >
                                <EyeOff size={17} />
                              </button>
                            </div>

                            {isRestoring ? (
                              <div className="mt-3 border-t border-white/5 pt-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {sidebarEmptySlots.map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => restoreSidebarWidget(widget.id, slot)}
                                      className="h-9 border border-[#00f5d4]/40 bg-[#00f5d4]/5 font-mono text-xs font-bold text-[#00f5d4] transition hover:bg-[#00f5d4]/10"
                                    >
                                      Slot {slot}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => restoreSidebarWidget(widget.id)}
                                    className={cn(
                                      "h-9 border border-[#ff2d85]/50 bg-[#ff2d85]/5 font-mono text-xs font-bold text-[#ff2d85] transition hover:bg-[#ff2d85]/10",
                                      sidebarEmptySlots.length === 0 && "col-span-2"
                                    )}
                                  >
                                    After last
                                  </button>
                                </div>
                                <p className="mt-2 font-mono text-[10px] text-[#a69db6] italic">
                                  Empty cells are unused positions in the current layout.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="border-b border-white/5 py-3 font-mono text-xs text-[#a69db6]">
                      No hidden widgets.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left border border-[#ff2d85]/35 bg-[#1d1524] p-4 shadow-[0_0_18px_rgba(255,45,133,0.08)]"
              onClick={() => setTemplateDropdownOpen((value) => !value)}
            >
              <span>
                <span className="block font-mono text-lg font-black text-[#ff2d85] drop-shadow-[0_0_8px_rgba(255,45,133,0.45)]">
                  Templates
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-[#a69db6]">
                  {selectedTemplate
                    ? `${selectedTemplate.name} · ${getLayoutCountLabel(selectedTemplate.layoutCount)}`
                    : 'Quickly apply a 2/4/6-widget layout.'}
                </span>
              </span>
              {templateDropdownOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-[#ff2d85]" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-[#ff2d85]" size={20} />
              )}
            </button>

            {templateDropdownOpen ? (
              <div className="space-y-4 px-1 pb-2">
                <label className="flex h-11 items-center gap-2 rounded border border-[#ff2d85]/40 bg-[#211b2d] px-3 shadow-[0_0_20px_rgba(255,45,133,0.12)]">
                  <Search size={20} className="text-[#ff2d85]" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates"
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-[#f3edff] outline-none placeholder:text-[#777086]"
                  />
                </label>

                <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => {
                    const selected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          applyTemplate(template.id);
                          setTemplateDropdownOpen(false);
                        }}
                        className={cn(
                          'relative w-full p-3 text-left transition rounded border bg-[#191727]',
                          selected
                            ? 'border-[#ff2d85] shadow-[0_0_24px_rgba(255,45,133,0.32)]'
                            : 'border-[#2b2740] hover:border-[#ff2d85]/40',
                        )}
                      >
                        {selected ? (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#ff2d85] text-[#ff2d85]">
                            <Check size={11} />
                          </span>
                        ) : null}
                        {renderTemplatePreview(template.id)}
                        <p className={cn('mt-4 font-mono text-base font-black', selected ? 'text-[#ff2d85]' : 'text-[#f3edff]')}>
                          {template.name}
                        </p>
                        <p className="mt-1 font-mono text-xs tracking-normal text-[#a69db6]">
                          {template.description}
                        </p>
                        <p className="mt-2 font-mono text-xs font-bold text-[#00f5d4]">
                          {getLayoutCountLabel(template.layoutCount)}
                        </p>
                      </button>
                    );
                  })}

                  <div className="p-3 rounded border border-[#2b2740] bg-[#191727]">
                    <div className="h-20 border border-[#2b2740] bg-[#151421]" />
                    <p className="mt-4 font-mono text-base font-black">Terminal focus</p>
                    <p className="mt-1 font-mono text-xs tracking-normal text-[#a69db6]">
                      {extraTemplate.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="h-12 w-full rounded border border-dashed border-[#ff2d85]/50 bg-transparent font-mono text-sm font-bold text-[#ff2d85] transition hover:bg-[#ff2d85]/10"
                >
                  + Add template
                </button>
              </div>
            ) : null}
          </div>

          <Button
            variant="secondary"
            className="h-12 w-full border-[#00f5d4] text-[#00f5d4] hover:bg-[#00f5d4]/10"
            onClick={openDetailModal}
          >
            Advanced settings
          </Button>
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <Button
            className="h-14 w-full rounded-full border-none bg-gradient-to-r from-[#ff2d85] to-[#9f0645] text-white shadow-[0_0_28px_rgba(255,45,133,0.46)]"
            onClick={saveAndClose}
          >
            Save
          </Button>
        </div>
      </aside>

      {detailModalOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={closeDetailModal} />
          <div className="fixed inset-x-4 top-8 z-[70] mx-auto max-h-[calc(100vh-4rem)] w-[min(920px,calc(100vw-2rem))] overflow-y-auto rounded border border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="font-mono text-3xl font-black text-[#f3edff] drop-shadow-[0_0_12px_rgba(255,45,133,0.55)]">
                  Edit template
                </h2>
                <p className="mt-1 font-mono text-xs text-[#a69db6]">
                  {detailStep === 'template'
                    ? 'Choose layout and KPI cards first.'
                    : 'Pick a slot, then configure API parameters.'}
                </p>
              </div>
              <button className="rounded p-1.5 text-[#a69db6] hover:bg-white/10 hover:text-white" onClick={closeDetailModal}>
                <X size={20} />
              </button>
            </div>

            {detailStep === 'template' ? (
              <div className="space-y-7 px-6 py-6">
                <Field label="Template name">
                  <Input value="Current template" readOnly />
                </Field>

                <div>
                  <p className="font-mono text-lg font-black text-[#f3edff]">Layout</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {[
                      { count: 2, icon: Grid2X2 },
                      { count: 4, icon: LayoutGrid },
                      { count: 6, icon: Grid3X3 },
                    ].map((option) => {
                      const Icon = option.icon;
                      const selected = layoutCount === option.count;
                      return (
                        <button
                          key={option.count}
                          type="button"
                          onClick={() => applyLayoutCount(option.count as 2 | 4 | 6)}
                          className={cn(
                            'flex h-28 flex-col items-center justify-center gap-2 rounded border transition',
                            selected
                              ? 'border-[#ff2d85] bg-[#ff2d85]/10 text-[#ff2d85]'
                              : 'border-white/10 bg-[#151421] text-[#a69db6] hover:border-white/25',
                          )}
                        >
                          <Icon size={24} />
                          <span className="font-mono text-sm font-bold">{option.count} widget</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-lg font-black text-[#f3edff]">
                      KPI cards
                    </p>
                    <span className="font-mono text-[11px] text-[#777086]">
                      Summary API fields
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {kpiWidgets.map((widget) => {
                      const option = summaryOptions.find((item) => item.key === widget.type);
                      const Icon = option?.icon ?? Activity;
                      return (
                        <div key={widget.id} className="rounded border border-white/10 bg-[#151421] p-4">
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#ff2d85]/15 text-[#ff2d85]">
                                  <Icon size={18} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-[#f3edff]">{option?.title ?? widget.title}</p>
                                  <p className="mt-1 text-sm text-[#a69db6]">{option?.description}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                title={widget.visible ? 'Hide KPI card' : 'Show KPI card'}
                                onClick={() => toggleKpi(widget.id)}
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded border transition',
                                  widget.visible
                                    ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4]'
                                    : 'border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85]',
                                )}
                              >
                                {widget.visible ? <Eye size={17} /> : <EyeOff size={17} />}
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                              <Field label="Card content">
                                <Select
                                  value={widget.type}
                                  onChange={(event) =>
                                    setDetailDraftWidgets((current) =>
                                      updateKpiContent(current, widget.id, event.target.value as KpiWidgetKind),
                                    )
                                  }
                                >
                                  {summaryOptions.map((item) => (
                                    <option key={item.key} value={item.key}>
                                      {item.title}
                                    </option>
                                  ))}
                                </Select>
                              </Field>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  title={widget.info1 ? 'Description visible' : 'Description hidden'}
                                  onClick={() => setDetailDraftWidgets((current) => updateWidget(current, widget.id, { info1: !widget.info1 }))}
                                  className={cn(
                                    'flex h-11 w-11 items-center justify-center rounded border transition',
                                    widget.info1
                                      ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4]'
                                      : 'border-[#2b2740] bg-[#191727] text-[#a69db6] hover:border-[#ff2d85]/60',
                                  )}
                                >
                                  <TypeIcon size={17} />
                                </button>
                                <button
                                  type="button"
                                  title={widget.info2 ? 'Icon visible' : 'Icon hidden'}
                                  onClick={() => setDetailDraftWidgets((current) => updateWidget(current, widget.id, { info2: !widget.info2 }))}
                                  className={cn(
                                    'flex h-11 w-11 items-center justify-center rounded border transition',
                                    widget.info2
                                      ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4]'
                                      : 'border-[#2b2740] bg-[#191727] text-[#a69db6] hover:border-[#ff2d85]/60',
                                  )}
                                >
                                  <Icon size={17} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-5">
                  <Button variant="ghost" className="h-11 px-5" onClick={closeDetailModal}>Cancel</Button>
                  <Button variant="secondary" className="h-11 px-6 border-[#00f5d4] text-[#00f5d4]" onClick={goToWidgetStep}>
                    Edit widgets
                  </Button>
                  <Button className="h-11 px-6" onClick={saveDetailDraft}>Save changes</Button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                <h3 className="text-5xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.45)]">Edit widget</h3>
                <div className="mt-8 grid gap-7 lg:grid-cols-[260px_1fr]">
                  <div>
                    <p className="font-mono text-lg font-black text-[#00f5d4] drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]">
                      Layout map
                    </p>
                    <div className="mt-4 rounded border border-white/10 bg-[#0c0b14] p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: layoutCount }).map((_, index) => {
                          const slot = index + 1;
                          const widget = visibleChartWidgets.find((item) => item.layoutOrder === slot);
                          if (!widget) {
                            return (
                              <div
                                key={`empty-${slot}`}
                                className="flex min-h-28 flex-col items-center justify-center rounded border border-dashed border-[#2b2740] bg-[#151421]/70 p-3 text-[#777086]"
                              >
                                <span className="text-2xl font-black">+</span>
                                <span className="mt-2 font-mono text-xs">Slot {slot}</span>
                              </div>
                            );
                          }
                          const selected = selectedSlot?.id === widget.id;
                          return (
                            <button
                              key={widget.id}
                              type="button"
                              onClick={() => setSelectedSlotId(widget.id)}
                              className={cn(
                                'flex min-h-28 flex-col items-center justify-center rounded border bg-[#2a2942] p-3 transition',
                                widget.layoutSpan === 2 && 'col-span-2',
                                selected
                                  ? 'border-[#ff2d85] bg-[#2d0f21] text-[#ff2d85] shadow-[0_0_20px_rgba(255,45,133,0.28)]'
                                  : 'border-transparent text-[#a69db6] hover:border-white/20',
                              )}
                            >
                              <span className="text-2xl font-black">{widget.layoutOrder}</span>
                              <span className="mt-2 max-w-full truncate text-xs">{widget.title}</span>
                              {widget.layoutSpan === 2 ? <span className="mt-1 font-mono text-[10px] text-[#00f5d4]">2 desktop cells</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-sm italic text-[#a69db6]">
                      + cells are open slots in the current {getLayoutCountLabel(layoutCount).toLowerCase()}.
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-2xl font-black text-[#f3edff]">
                      Slot {selectedSlot?.layoutOrder ?? 1} settings
                    </p>
                    {selectedSlot ? (
                      <div className="mt-4 rounded border border-[#ff2d85]/70 bg-[#0c0b14] p-6">
                        <div className="grid gap-4">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              aria-checked={selectedSlot.visible}
                              title={selectedSlot.visible ? 'Visible on dashboard' : 'Hidden from dashboard'}
                              onClick={() =>
                                setDetailDraftWidgets((current) => {
                                  const nextWidgets = selectedSlot.visible
                                    ? hideChartWidget(current, selectedSlot.id)
                                    : restoreChartWidget(current, selectedSlot.id);
                                  const nextSelected = getVisibleChartWidgets(nextWidgets)[0]?.id ?? getChartWidgets(nextWidgets)[0]?.id ?? null;
                                  setSelectedSlotId(selectedSlot.visible ? nextSelected : selectedSlot.id);
                                  return nextWidgets;
                                })
                              }
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded border transition',
                                selectedSlot.visible
                                  ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] shadow-[0_0_16px_rgba(0,245,212,0.25)]'
                                  : 'border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85] shadow-[0_0_16px_rgba(255,45,133,0.25)]',
                              )}
                            >
                              {selectedSlot.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                          </div>

                          <Field label="Widget name" hint="Leave blank to use data + time range.">
                            <Input
                              value={selectedSlot.title}
                              placeholder={getDefaultWidgetTitle(selectedSlot)}
                              onChange={(event) =>
                                setDetailDraftWidgets((current) =>
                                  updateWidget(current, selectedSlot.id, { title: event.target.value }),
                                )
                              }
                            />
                          </Field>

                          <Field label="Widget type">
                            <Select
                              value={selectedSlot.chartType}
                              onChange={(event) =>
                                setDetailDraftWidgets((current) =>
                                  updateWidget(
                                    current,
                                    selectedSlot.id,
                                    normalizeChartPatch(event.target.value as WidgetSettingsValues['chartType'], selectedSlot),
                                  ),
                                )
                              }
                            >
                              {chartTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          </Field>

                          <div>
                            <p className="mb-3 font-mono text-sm font-bold tracking-normal text-[#a69db6]">
                              Desktop size
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { value: 1, label: '1 cell' },
                                { value: 2, label: '2 cells' },
                              ].map((option) => {
                                const selected = selectedSlot.layoutSpan === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, { layoutSpan: option.value as 1 | 2 }),
                                      )
                                    }
                                    className={cn(
                                      'h-11 border font-mono text-sm font-bold transition',
                                      selected
                                        ? 'border-[#ff2d85] bg-[#ff2d85]/10 text-[#ff2d85]'
                                        : 'border-[#2b2740] bg-[#191727] text-[#a69db6] hover:border-[#ff2d85]/60',
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 font-mono text-xs text-[#777086]">
                              Use 1 cell for compact charts. Use 2 cells for tables, heatmaps, or wide charts.
                              On medium screens and below, widgets become 1 cell.
                            </p>
                          </div>

                          {selectedSlot.chartType === 'line' || selectedSlot.chartType === 'bar' || selectedSlot.chartType === 'pie' ? (
                            <>
                              <Field label="Data">
                                <Select
                                  value={selectedSlot.metric}
                                  onChange={(event) =>
                                    setDetailDraftWidgets((current) =>
                                      updateWidget(current, selectedSlot.id, { metric: event.target.value as WidgetSettingsValues['metric'] }),
                                    )
                                  }
                                >
                                  {informationScenarios.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </Select>
                              </Field>
                              {selectedSlot.chartType === 'bar' || selectedSlot.chartType === 'pie' ? (
                                <Field label={selectedSlot.chartType === 'pie' ? 'Slice by' : 'Group by'}>
                                  <Select
                                    value={selectedSlot.groupBy}
                                    onChange={(event) =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, { groupBy: event.target.value as WidgetSettingsValues['groupBy'] }),
                                      )
                                    }
                                  >
                                    {groupScenarios
                                      .filter((option) => selectedSlot.chartType === 'bar' || option.value !== 'none')
                                      .map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Select>
                                </Field>
                              ) : null}
                              {selectedSlot.chartType === 'line' || (selectedSlot.chartType === 'bar' && selectedSlot.groupBy === 'none') ? (
                                <Field label="Time bucket">
                                  <Select
                                    value={selectedSlot.timeBucket}
                                    onChange={(event) =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, { timeBucket: event.target.value as WidgetSettingsValues['timeBucket'] }),
                                      )
                                    }
                                  >
                                    {timeBucketOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </Select>
                                </Field>
                              ) : null}
                            </>
                          ) : null}

                          {selectedSlot.chartType === 'heatmap' ? (
                            <Field label="Heatmap mode">
                              <Select
                                value={selectedSlot.heatmapMode}
                                onChange={(event) => {
                                  const heatmapMode = event.target.value as WidgetSettingsValues['heatmapMode'];
                                  const yearRange = heatmapMode === 'calendar'
                                    ? getYearDateRange(getYearFromDate(selectedSlot.startDate))
                                    : {};
                                  setDetailDraftWidgets((current) =>
                                    updateWidget(current, selectedSlot.id, { heatmapMode, ...yearRange }),
                                  );
                                }}
                              >
                                {heatmapModeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </Select>
                            </Field>
                          ) : null}

                          <div>
                            <p className="mb-3 font-mono text-sm font-bold tracking-normal text-[#a69db6]">
                              Display options
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {getDisplayOptions(selectedSlot).map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() =>
                                    setDetailDraftWidgets((current) =>
                                      updateWidget(current, selectedSlot.id, { [option.key]: !option.checked }),
                                    )
                                  }
                                  className={cn(
                                    'flex items-center justify-between border p-3 text-left font-mono text-sm transition',
                                    option.checked
                                      ? 'border-[#00f5d4]/40 bg-[#00f5d4]/5 text-[#f3edff]'
                                      : 'border-[#2b2740] bg-[#191727] text-[#a69db6]',
                                  )}
                                >
                                  <span>{option.label}</span>
                                  <span
                                    className={cn(
                                      'flex h-5 w-5 items-center justify-center rounded transition',
                                      option.checked ? 'bg-[#00f5d4] text-[#0c0b14]' : 'border border-white/20',
                                    )}
                                  >
                                    {option.checked ? <Check size={13} strokeWidth={3} /> : null}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            {selectedSlot.chartType === 'heatmap' && selectedSlot.heatmapMode === 'calendar' ? (
                              <>
                                <p className="mb-3 font-mono text-sm font-bold tracking-normal text-[#a69db6]">
                                  Year
                                </p>
                                <p className="mb-4 border border-[#2b2740] bg-[#191727] px-3 py-2 font-mono text-xs text-[#f3edff]">
                                  {getYearFromDate(selectedSlot.startDate) === String(new Date().getFullYear())
                                    ? `${getYearFromDate(selectedSlot.startDate)} · Jan 1 to today`
                                    : `${getYearFromDate(selectedSlot.startDate)} · Jan 1 to Dec 31`}
                                </p>
                                <Field label="Year">
                                  <Input
                                    type="number"
                                    min="2020"
                                    max={String(new Date().getFullYear())}
                                    value={getYearFromDate(selectedSlot.startDate)}
                                    onChange={(event) =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, getYearDateRange(event.target.value)),
                                      )
                                    }
                                  />
                                </Field>
                              </>
                            ) : (
                              <>
                                <p className="mb-3 font-mono text-sm font-bold tracking-normal text-[#a69db6]">
                                  Time range
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label="Start date">
                                    <Input
                                      type="date"
                                      value={selectedSlot.startDate}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(current, selectedSlot.id, { startDate: event.target.value }),
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="End date">
                                    <Input
                                      type="date"
                                      value={selectedSlot.endDate}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(current, selectedSlot.id, { endDate: event.target.value }),
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">
                  <Button variant="ghost" className="h-11 px-5" onClick={() => setDetailStep('template')}>Back</Button>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" className="h-11 px-5" onClick={closeDetailModal}>Cancel</Button>
                    <Button className="h-11 px-6" onClick={saveDetailDraft}>Save changes</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
