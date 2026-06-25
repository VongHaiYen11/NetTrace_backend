import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PenLine,
  PieChart,
  Plus,
  RadioTower,
  Search,
  Table,
  TrendingUp,
  Type as TypeIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import {
  nettraceApi,
  type ExportColumn,
  type PresetSummary,
  type TemplateDetail,
  type TemplateSummary,
  type TemplateWidgetDetail,
  type TemplateWidgetInput,
} from '../../../services/generated/nettrace-api';
import { cn } from '../../../utils/cn';
import type { WidgetKind, WidgetSettingsValues } from './WidgetSettingsDrawer';

export type DashboardWidgetConfig = WidgetSettingsValues & {
  id: string;
  title: string;
  type: WidgetKind;
  layoutOrder: number;
  layoutSpan: 1 | 2;
};

type LayoutCount = 2 | 3 | 4 | 5 | 6;

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  layoutCount: LayoutCount;
  apply: (widgets: DashboardWidgetConfig[]) => DashboardWidgetConfig[];
}

interface GeneralSettingsDrawerProps {
  isOpen: boolean;
  widgets: DashboardWidgetConfig[];
  activeTemplate: { id: string; name: string } | null;
  createTemplateRequestId?: number;
  variant?: 'drawer' | 'modal';
  templateId?: number;
  templateName?: string;
  onClose: () => void;
  onSave: (widgets: DashboardWidgetConfig[]) => void;
  onTemplateChange: (template: { id: string; name: string } | null) => void;
  onTemplateSaved?: () => void;
}

interface TemplateEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  widgets: DashboardWidgetConfig[];
  templateId?: number;
  templateName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const summaryOptions = [
  {
    key: 'kpi-total',
    icon: RadioTower,
    title: 'Total alarms',
    fields: ['totalAlarms'],
    description: 'Shows total alarms.',
  },
  {
    key: 'kpi-active',
    icon: Activity,
    title: 'Active alarms',
    fields: ['activeAlarms'],
    description: 'Shows active alarms.',
  },
  {
    key: 'kpi-closed',
    icon: Check,
    title: 'Closed alarms',
    fields: ['closedAlarms'],
    description: 'Shows closed alarms.',
  },
  {
    key: 'kpi-devices',
    icon: TrendingUp,
    title: 'Affected devices',
    fields: ['affectedDevices'],
    description: 'Shows the unique affected device count.',
  },
  {
    key: 'kpi-critical',
    icon: AlertTriangle,
    title: 'Critical alarms',
    fields: ['criticalAlarms'],
    description: 'Shows critical alarms.',
  },
] as const;

type KpiWidgetKind = (typeof summaryOptions)[number]['key'];

function normalizeKpiKind(kind: WidgetKind): KpiWidgetKind {
  if (kind === 'kpi-count') return 'kpi-total';
  if (kind === 'kpi-status') return 'kpi-critical';
  return kind as KpiWidgetKind;
}

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

const tableColumnOptions: Array<{ value: ExportColumn; label: string }> = [
  { value: 'alarm_id', label: 'Alarm ID' },
  { value: 'time_created', label: 'Time created' },
  { value: 'time_solved', label: 'Time solved' },
  { value: 'status', label: 'Status' },
  { value: 'severity', label: 'Severity' },
  { value: 'error_code', label: 'Error code' },
  { value: 'error_name', label: 'Error name' },
  { value: 'error_domain', label: 'Error domain' },
  { value: 'device_id', label: 'Device ID' },
  { value: 'device_name', label: 'Device name' },
  { value: 'device_type', label: 'Device type' },
  { value: 'station_name', label: 'Station name' },
  { value: 'station_province', label: 'Province' },
  { value: 'vendor_name', label: 'Vendor name' },
  { value: 'raw_log', label: 'Raw log' },
  { value: 'description', label: 'Description' },
];

const defaultTableColumns: ExportColumn[] = [
  'time_created',
  'error_name',
  'status',
  'severity',
  'device_name',
  'description',
];

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

function withVisibleChartCount(widgets: DashboardWidgetConfig[], count: LayoutCount) {
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

function getSelectedKpiKinds(widgets: DashboardWidgetConfig[]) {
  return widgets
    .filter((widget) => widget.type.startsWith('kpi') && widget.visible)
    .map((widget) => normalizeKpiKind(widget.type));
}

function getKpiWidgetForKind(widgets: DashboardWidgetConfig[], kind: KpiWidgetKind) {
  return widgets.find((widget) => widget.type.startsWith('kpi') && widget.visible && normalizeKpiKind(widget.type) === kind);
}

function applyKpiSelection(widgets: DashboardWidgetConfig[], kind: KpiWidgetKind, checked: boolean) {
  const selectedKinds = getSelectedKpiKinds(widgets);
  const existingWidget = getKpiWidgetForKind(widgets, kind);

  if (!checked) {
    return existingWidget ? updateWidget(widgets, existingWidget.id, { visible: false }) : widgets;
  }

  if (existingWidget || selectedKinds.length >= 3) return widgets;

  const availableSlot = widgets.find((widget) => widget.type.startsWith('kpi') && !widget.visible);
  if (!availableSlot) {
    const sourceWidget = widgets.find((widget) => widget.type.startsWith('kpi')) ?? widgets[0];
    const option = summaryOptions.find((item) => item.key === kind);
    const newWidget: DashboardWidgetConfig = {
      id: `kpi-${kind}-${Date.now()}`,
      type: kind,
      title: option?.title ?? 'KPI Card',
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
      preset: sourceWidget?.preset ?? 'Active Connections',
      startDate: sourceWidget?.startDate ?? '2026-06-01',
      endDate: sourceWidget?.endDate ?? '2026-06-30',
    };
    return [...widgets, newWidget];
  }

  return updateKpiContent(
    updateWidget(widgets, availableSlot.id, { visible: true }),
    availableSlot.id,
    kind,
  );
}

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDraftTemplateName() {
  const now = new Date();
  const parts = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ];
  return `Untitled${parts.join('')}`;
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

export function getLayoutCapacity(widgets: DashboardWidgetConfig[]) {
  const visibleCount = getVisibleChartWidgets(widgets).length;
  return Math.min(6, Math.max(2, visibleCount)) as LayoutCount;
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

function insertChartWidget(widgets: DashboardWidgetConfig[], widget: DashboardWidgetConfig, slot: number) {
  const shiftedWidgets = compactVisibleChartOrder(widgets).map((item) => {
    if (!item.type.startsWith('kpi') && item.visible && item.layoutOrder >= slot) {
      return { ...item, layoutOrder: item.layoutOrder + 1 };
    }
    return item;
  });
  return [...shiftedWidgets, { ...widget, visible: true, layoutOrder: slot }];
}

const drawerIconButtonClass =
  'flex shrink-0 items-center justify-center rounded bg-transparent text-secondary transition hover:text-secondary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30';

const drawerMutedIconButtonClass =
  'flex shrink-0 items-center justify-center rounded bg-transparent text-muted transition hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30';

const drawerDangerIconButtonClass =
  'flex shrink-0 items-center justify-center rounded bg-transparent text-primary-light transition hover:text-primary-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

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

export function buildTemplateSnapshot(widgets: DashboardWidgetConfig[], layoutCount: LayoutCount) {
  return JSON.stringify({
    version: 1,
    layoutCount,
    widgets: widgets.map(normalizeWidgetTitle),
  });
}

export function buildTemplateWidgetInputs(widgets: DashboardWidgetConfig[]): TemplateWidgetInput[] {
  return getVisibleChartWidgets(widgets).map((widget) => ({
    preset_name: widget.title || getDefaultWidgetTitle(widget),
    position: widget.layoutOrder,
    chart_type: widget.chartType,
    start_date: widget.startDate || null,
    end_date: widget.endDate || null,
    status: null,
    severity: null,
    error_code: null,
    vendor: null,
    device_type: null,
  }));
}

function readTemplateSnapshot(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { widgets?: DashboardWidgetConfig[]; layoutCount?: LayoutCount };
    if (!Array.isArray(parsed.widgets)) return null;
    return {
      widgets: parsed.widgets,
      layoutCount: parsed.layoutCount,
    };
  } catch {
    return null;
  }
}

function getSavedTemplateName(template: TemplateSummary) {
  return template.name || `Saved template ${template.template_id}`;
}

function createDashboardTemplateFromSaved(template: TemplateSummary): DashboardTemplate | null {
  const snapshot = readTemplateSnapshot(template.selected_cards);
  if (!snapshot) return null;

  return {
    id: `db:${template.template_id}`,
    name: getSavedTemplateName(template),
    description: 'POSTGRES / SAVED_LAYOUT',
    layoutCount: snapshot.layoutCount ?? getLayoutCapacity(snapshot.widgets),
    apply: () => snapshot.widgets,
  };
}

function normalizeTemplateChartType(value: string | null | undefined): DashboardWidgetConfig['chartType'] {
  if (value === 'line' || value === 'bar' || value === 'pie' || value === 'table' || value === 'heatmap') {
    return value;
  }
  return 'line';
}

function normalizeTemplateDate(value: string | null | undefined, fallback: string) {
  return value ? value.slice(0, 10) : fallback;
}

function applyPresetToWidget(
  widget: DashboardWidgetConfig,
  preset: PresetSummary,
): DashboardWidgetConfig {
  const chartType = normalizeTemplateChartType(preset.chart_type);
  return {
    ...widget,
    title: preset.preset_name || `Preset ${preset.preset_id}`,
    preset: `preset:${preset.preset_id}`,
    chartType,
    groupBy: chartType === 'pie' ? 'severity' : 'none',
    metric: 'count',
    timeBucket: 'day',
    heatmapMode: chartType === 'heatmap' ? 'weekday' : widget.heatmapMode,
    layoutSpan: chartType === 'table' || chartType === 'heatmap' ? 2 : 1,
    startDate: normalizeTemplateDate(preset.start_date, widget.startDate),
    endDate: normalizeTemplateDate(preset.end_date, widget.endDate),
  };
}

function applyTemplateWidgetsFromDb(
  sourceWidgets: DashboardWidgetConfig[],
  templateWidgets: TemplateWidgetDetail[],
) {
  const orderedTemplateWidgets = [...templateWidgets].sort(
    (a, b) => a.preset.position - b.preset.position || a.widget_id - b.widget_id,
  );
  const chartSlots = getChartWidgets(sourceWidgets);
  const visibleCount = Math.min(Math.max(orderedTemplateWidgets.length, 2), 6) as LayoutCount;
  const updatesById = new Map<string, Partial<DashboardWidgetConfig>>();

  orderedTemplateWidgets.slice(0, chartSlots.length).forEach((templateWidget, index) => {
    const slot = chartSlots[index];
    const chartType = normalizeTemplateChartType(templateWidget.preset.chart_type);
    updatesById.set(slot.id, {
      title: templateWidget.preset.preset_name || `Preset ${templateWidget.preset.preset_id}`,
      visible: true,
      layoutOrder: templateWidget.preset.position || index + 1,
      chartType,
      groupBy: chartType === 'pie' ? 'severity' : 'none',
      metric: 'count',
      timeBucket: 'day',
      heatmapMode: chartType === 'heatmap' ? 'weekday' : slot.heatmapMode,
      layoutSpan: chartType === 'table' || chartType === 'heatmap' ? 2 : 1,
      startDate: normalizeTemplateDate(templateWidget.preset.start_date, slot.startDate || '2026-06-01'),
      endDate: normalizeTemplateDate(templateWidget.preset.end_date, slot.endDate || '2026-06-30'),
    });
  });

  return withVisibleChartCount(
    sourceWidgets.map((widget) => {
      if (widget.type.startsWith('kpi')) return widget;
      const patch = updatesById.get(widget.id);
      return patch
        ? { ...widget, ...patch }
        : { ...widget, visible: false };
    }),
    visibleCount,
  );
}

function createDashboardTemplateFromDetail(template: TemplateDetail): DashboardTemplate {
  const snapshotTemplate = createDashboardTemplateFromSaved(template);
  if (snapshotTemplate) {
    return {
      ...snapshotTemplate,
      apply: () => {
        const snapshot = readTemplateSnapshot(template.selected_cards);
        if (!snapshot) return [];
        const presetNamesByPosition = new Map(
          template.widgets.map((widget) => [
            widget.preset.position,
            widget.preset.preset_name || `Preset ${widget.preset.preset_id}`,
          ]),
        );
        return snapshot.widgets.map((widget) => {
          if (widget.type.startsWith('kpi')) return widget;
          const presetName = presetNamesByPosition.get(widget.layoutOrder);
          return presetName ? { ...widget, title: presetName } : widget;
        });
      },
    };
  }

  const layoutCount = Math.min(Math.max(template.widgets.length, 2), 6) as LayoutCount;
  return {
    id: `db:${template.template_id}`,
    name: getSavedTemplateName(template),
    description: 'POSTGRES / SAVED_LAYOUT',
    layoutCount,
    apply: (widgets) => applyTemplateWidgetsFromDb(widgets, template.widgets),
  };
}

function getSavedTemplateId(templateId: string | undefined) {
  if (!templateId?.startsWith('db:')) return null;
  const id = Number(templateId.replace('db:', ''));
  return Number.isFinite(id) ? id : null;
}

export function GeneralSettingsDrawer({
  isOpen,
  widgets,
  activeTemplate,
  createTemplateRequestId = 0,
  variant = 'drawer',
  templateId,
  templateName,
  onClose,
  onSave,
  onTemplateChange,
  onTemplateSaved,
}: GeneralSettingsDrawerProps) {
  const handledCreateTemplateRequestRef = useRef(0);
  const modalOnly = variant === 'modal';
  const [draftWidgets, setDraftWidgets] = useState(widgets);
  const [detailDraftWidgets, setDetailDraftWidgets] = useState(widgets);
  const [draftLayoutCount, setDraftLayoutCount] = useState<LayoutCount>(getLayoutCapacity(widgets));
  const [draftDashboardName, setDraftDashboardName] = useState(
    activeTemplate?.name ?? '',
  );
  const [editingDashboardName, setEditingDashboardName] = useState(false);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('none');
  const [savedTemplates, setSavedTemplates] = useState<DashboardTemplate[]>([]);
  const [savedPresets, setSavedPresets] = useState<PresetSummary[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [draftTemplateName, setDraftTemplateName] = useState(getDraftTemplateName);
  const [detailTemplateName, setDetailTemplateName] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [dashboardStatusOpen, setDashboardStatusOpen] = useState(false);
  const [sidebarLayoutDropdownOpen, setSidebarLayoutDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<'edit' | 'create'>('edit');
  const [detailStep, setDetailStep] = useState<'template' | 'widget'>('template');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [detailLayoutCount, setDetailLayoutCount] = useState<LayoutCount>(getLayoutCapacity(widgets));
  const [restoreWidgetId, setRestoreWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftWidgets(widgets);
      setDetailDraftWidgets(widgets);
      setDraftLayoutCount(getLayoutCapacity(widgets));
      setDraftDashboardName(activeTemplate?.name ?? '');
      setEditingDashboardName(false);
      setTemplateDirty(false);
      setSelectedTemplateId(activeTemplate?.id ?? 'none');
      setTemplateSearch('');
      setDraftTemplateName(getDraftTemplateName());
      setDetailTemplateName('');
      setDashboardStatusOpen(false);
      setSidebarLayoutDropdownOpen(false);
      setTemplateDropdownOpen(false);
      setDetailModalOpen(false);
      setDetailMode('edit');
      setDetailStep('template');
      setSelectedSlotId(null);
      setDetailLayoutCount(getLayoutCapacity(widgets));
      setRestoreWidgetId(null);
    }
  }, [activeTemplate?.id, activeTemplate?.name, isOpen, widgets]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadSavedTemplates() {
      try {
        const response = await nettraceApi.listTemplates({ limit: 50, offset: 0 });
        if (cancelled) return;
        const parsedTemplates = await Promise.all(
          response.data.map(async (template) => {
            try {
              const detail = await nettraceApi.getTemplateDetail(template.template_id);
              return createDashboardTemplateFromDetail(detail.data);
            } catch {
              const snapshotTemplate = createDashboardTemplateFromSaved(template);
              if (snapshotTemplate) return snapshotTemplate;
              return {
                id: `db:${template.template_id}`,
                name: getSavedTemplateName(template),
                description: 'POSTGRES / SAVED_LAYOUT',
                layoutCount: Math.min(Math.max(template.number_of_widgets || 2, 2), 6) as LayoutCount,
                apply: (currentWidgets: DashboardWidgetConfig[]) =>
                  withVisibleChartCount(currentWidgets, Math.min(Math.max(template.number_of_widgets || 2, 2), 6) as LayoutCount),
              };
            }
          }),
        );
        if (cancelled) return;
        setSavedTemplates(parsedTemplates);
      } catch {
        setSavedTemplates([]);
      }
    }

    void loadSavedTemplates();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadSavedPresets() {
      try {
        const response = await nettraceApi.listPresets({ limit: 1000, offset: 0 });
        if (!cancelled) setSavedPresets(response.data);
      } catch {
        if (!cancelled) setSavedPresets([]);
      }
    }

    void loadSavedPresets();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const layoutCount = detailLayoutCount;
  const sidebarKpiWidgets = draftWidgets.filter((widget) => widget.type.startsWith('kpi'));
  const chartWidgets = getChartWidgets(detailDraftWidgets);
  const visibleChartWidgets = getVisibleChartWidgets(detailDraftWidgets);
  const availableChartWidgets = getHiddenChartWidgets(detailDraftWidgets);
  const allDetailWidgetSlotsComplete = visibleChartWidgets.length === detailLayoutCount;
  const sidebarVisibleCharts = getVisibleChartWidgets(draftWidgets);
  const sidebarHiddenCharts = getHiddenChartWidgets(draftWidgets);
  const sidebarLayoutCount = draftLayoutCount;
  const sidebarEmptySlots = Array.from(
    { length: Math.max(0, sidebarLayoutCount - sidebarVisibleCharts.length) },
    (_, index) => sidebarVisibleCharts.length + index + 1,
  );
  const selectedEmptySlot = selectedSlotId?.startsWith('empty:')
    ? Number(selectedSlotId.replace('empty:', ''))
    : null;
  const selectedSlot = selectedSlotId?.startsWith('empty:')
    ? null
    : visibleChartWidgets.find((widget) => widget.id === selectedSlotId) ?? visibleChartWidgets[0] ?? null;
  const allTemplates = savedTemplates;
  const selectedTemplate = allTemplates.find((template) => template.id === selectedTemplateId);
  const hasSelectedTemplate = selectedTemplateId !== 'none';
  const headerTemplateName = draftDashboardName.trim() || selectedTemplate?.name || activeTemplate?.name || 'Untitled';
  const filteredTemplates = allTemplates.filter((template) =>
    `${template.name} ${template.description}`.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  useEffect(() => {
    if (!isOpen || createTemplateRequestId === 0) return;
    if (handledCreateTemplateRequestRef.current === createTemplateRequestId) return;

    handledCreateTemplateRequestRef.current = createTemplateRequestId;
    openCreateTemplateModal();
  }, [createTemplateRequestId, isOpen]);

  useEffect(() => {
    if (!modalOnly || !isOpen) return;

    if (templateId) {
      setDetailDraftWidgets(widgets);
      setDetailLayoutCount(getLayoutCapacity(widgets));
      setDetailTemplateName(templateName ?? '');
      setDetailMode('edit');
      setSelectedTemplateId('none');
      setSelectedSlotId(getVisibleChartWidgets(widgets)[0]?.id ?? 'empty:1');
      setDetailStep('template');
      setDetailModalOpen(true);
      return;
    }

    openCreateTemplateModal();
  }, [isOpen, modalOnly, templateId, templateName, widgets]);

  if (!isOpen) return null;

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setRestoreWidgetId(null);
    setTemplateDirty(false);
    const template = allTemplates.find((item) => item.id === templateId);
    if (!template) {
      setDraftWidgets([]);
      setDraftLayoutCount(2);
      setDraftDashboardName('');
      return;
    }
    setDraftWidgets(template.apply(widgets));
    setDraftLayoutCount(template.layoutCount);
    setDraftDashboardName(template.name);
  }

  function applyLayoutCount(count: LayoutCount) {
    setDetailLayoutCount(count);
    setDetailDraftWidgets((current) => {
      const visibleCharts = getVisibleChartWidgets(current);
      if (visibleCharts.length <= count) return current;
      const keptIds = new Set(visibleCharts.slice(0, count).map((widget) => widget.id));
      return compactVisibleChartOrder(
        current.map((widget) =>
          !widget.type.startsWith('kpi') && widget.visible && !keptIds.has(widget.id)
            ? { ...widget, visible: false }
            : widget,
        ),
      );
    });
    setSelectedSlotId((current) => {
      if (current?.startsWith('empty:')) {
        const slot = Number(current.replace('empty:', ''));
        return `empty:${Math.min(slot || 1, count)}`;
      }
      const selectedWidget = visibleChartWidgets.find((widget) => widget.id === current);
      if (selectedWidget && selectedWidget.layoutOrder <= count) return current;
      return `empty:${Math.min(getVisibleChartWidgets(detailDraftWidgets).length + 1, count)}`;
    });
  }

  function applySidebarLayoutCount(count: LayoutCount) {
    setTemplateDirty(true);
    setDraftLayoutCount(count);
    setRestoreWidgetId(null);
    setDraftWidgets((current) => {
      const visibleCharts = getVisibleChartWidgets(current);
      if (visibleCharts.length <= count) return current;
      const keptIds = new Set(visibleCharts.slice(0, count).map((widget) => widget.id));
      return compactVisibleChartOrder(
        current.map((widget) =>
          !widget.type.startsWith('kpi') && widget.visible && !keptIds.has(widget.id)
            ? { ...widget, visible: false }
            : widget,
        ),
      );
    });
  }

  function startRestoreSidebarWidget(widgetId: string) {
    setRestoreWidgetId(widgetId);
  }

  function removeSidebarWidget(widgetId: string) {
    setTemplateDirty(true);
    setRestoreWidgetId(null);
    setDraftWidgets((current) => hideChartWidget(current, widgetId));
  }

  function restoreSidebarWidget(widgetId: string, slot?: number) {
    setTemplateDirty(true);
    setDraftWidgets((current) => restoreChartWidget(current, widgetId, slot));
    setRestoreWidgetId(null);
  }

  function restoreDetailWidget(widgetId: string, slot?: number) {
    setDetailDraftWidgets((current) => restoreChartWidget(current, widgetId, slot));
    setSelectedSlotId(widgetId);
  }

  function clearDetailSlot(widgetId: string) {
    setDetailDraftWidgets((current) => {
      const nextWidgets = hideChartWidget(current, widgetId);
      const nextEmptySlot = Math.min(detailLayoutCount, getVisibleChartWidgets(nextWidgets).length + 1);
      setSelectedSlotId(`empty:${nextEmptySlot}`);
      return nextWidgets;
    });
  }

  function createDetailWidget(slot: number) {
    const sourceWidget = visibleChartWidgets[0] ?? chartWidgets[0] ?? detailDraftWidgets[0];
    const widgetId = `custom-${Date.now()}`;
    const nextWidget: DashboardWidgetConfig = {
      id: widgetId,
      type: 'chart-extra',
      title: '',
      layoutOrder: slot,
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
      tableColumns: defaultTableColumns,
      preset: sourceWidget?.preset ?? 'Active Connections',
      startDate: sourceWidget?.startDate ?? '2026-06-01',
      endDate: sourceWidget?.endDate ?? '2026-06-30',
    };
    setDetailDraftWidgets((current) => insertChartWidget(current, nextWidget, slot));
    setSelectedSlotId(widgetId);
  }

  function createDetailWidgetFromPreset(slot: number, preset: PresetSummary) {
    const sourceWidget = visibleChartWidgets[0] ?? chartWidgets[0] ?? detailDraftWidgets[0];
    const baseWidget: DashboardWidgetConfig = {
      id: `preset-widget-${preset.preset_id}-${Date.now()}`,
      type: 'chart-extra',
      title: preset.preset_name || `Preset ${preset.preset_id}`,
      layoutOrder: slot,
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
      tableColumns: defaultTableColumns,
      preset: `preset:${preset.preset_id}`,
      startDate: sourceWidget?.startDate ?? '2026-06-01',
      endDate: sourceWidget?.endDate ?? '2026-06-30',
    };
    const nextWidget = applyPresetToWidget(baseWidget, preset);
    setDetailDraftWidgets((current) => insertChartWidget(current, nextWidget, slot));
    setSelectedSlotId(nextWidget.id);
  }

  function applyDetailPreset(widgetId: string, presetId: number) {
    const preset = savedPresets.find((item) => item.preset_id === presetId);
    if (!preset) return;
    setDetailDraftWidgets((current) =>
      current.map((widget) =>
        widget.id === widgetId ? applyPresetToWidget(widget, preset) : widget,
      ),
    );
  }

  async function saveAndClose() {
    const savedTemplateId = getSavedTemplateId(selectedTemplate?.id ?? activeTemplate?.id);
    if (!savedTemplateId) {
      onSave([]);
      onTemplateChange(null);
      onClose();
      return;
    }

    const normalizedWidgets = draftWidgets.map(normalizeWidgetTitle);
    if (templateDirty) {
      const saved = await updateTemplateFromDraft(
        normalizedWidgets,
        draftLayoutCount,
        savedTemplateId,
        selectedTemplate?.name ?? activeTemplate?.name,
        headerTemplateName,
      );
      if (!saved) return;
    }
    onSave(normalizedWidgets);
    onTemplateChange({ id: `db:${savedTemplateId}`, name: headerTemplateName });
    onClose();
  }

  function openDetailModal() {
    setDetailDraftWidgets(draftWidgets);
    setDetailLayoutCount(draftLayoutCount);
    setDetailTemplateName(selectedTemplateId === 'none' ? '' : selectedTemplate?.name ?? activeTemplate?.name ?? '');
    setDetailMode('edit');
    setSelectedSlotId(getVisibleChartWidgets(draftWidgets)[0]?.id ?? 'empty:1');
    setDetailStep('template');
    setDetailModalOpen(true);
  }

  function openCreateTemplateModal() {
    const emptyWidgets = compactVisibleChartOrder(
      widgets.map((widget) => (widget.type.startsWith('kpi') ? widget : { ...widget, visible: false })),
    );
    setDetailDraftWidgets(emptyWidgets);
    setDetailLayoutCount(2);
    setDetailTemplateName('');
    setDetailMode('create');
    setSelectedTemplateId('none');
    setSelectedSlotId('empty:1');
    setDetailStep('template');
    setTemplateDropdownOpen(false);
    setDetailModalOpen(true);
  }

  function saveDetailDraft() {
    setDraftWidgets(detailDraftWidgets.map(normalizeWidgetTitle));
    setDraftLayoutCount(detailLayoutCount);
    setSelectedTemplateId('none');
    onTemplateChange(null);
    setDetailModalOpen(false);
  }

  async function createTemplateFromDraft(sourceWidgets = draftWidgets, sourceLayoutCount = draftLayoutCount) {
    setCreatingTemplate(true);
    try {
      const normalizedWidgets = sourceWidgets.map(normalizeWidgetTitle);
      const normalizedTemplateName = detailTemplateName.trim() || 'Untitled';
      const created = await nettraceApi.createTemplate({
        name: normalizedTemplateName,
        selected_cards: buildTemplateSnapshot(normalizedWidgets, sourceLayoutCount),
        widgets: buildTemplateWidgetInputs(normalizedWidgets),
      });
      const savedTemplate = createDashboardTemplateFromSaved(created.data);
      if (savedTemplate) {
        setSavedTemplates((current) => [savedTemplate, ...current]);
        setSelectedTemplateId(savedTemplate.id);
        setDraftWidgets(savedTemplate.apply(normalizedWidgets));
        setDraftLayoutCount(savedTemplate.layoutCount);
        setDetailTemplateName('');
      }
      toast.success('Template saved');
      onTemplateSaved?.();
      return {
        id: `db:${created.data.template_id}`,
        name: normalizedTemplateName,
        widgets: normalizedWidgets,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save template.';
      toast.error(message);
      return null;
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function updateTemplateFromDraft(
    sourceWidgets = detailDraftWidgets,
    sourceLayoutCount = detailLayoutCount,
    targetTemplateId = templateId,
    fallbackTemplateName = templateName,
    requestedTemplateName = detailTemplateName,
  ) {
    if (!targetTemplateId) return false;

    setCreatingTemplate(true);
    try {
      const normalizedWidgets = sourceWidgets.map(normalizeWidgetTitle);
      const normalizedTemplateName = requestedTemplateName.trim() || fallbackTemplateName || 'Untitled';
      const updated = await nettraceApi.updateTemplate(targetTemplateId, {
        name: normalizedTemplateName,
        selected_cards: buildTemplateSnapshot(normalizedWidgets, sourceLayoutCount),
        widgets: buildTemplateWidgetInputs(normalizedWidgets),
      });
      const savedTemplate = createDashboardTemplateFromSaved(updated.data);
      if (savedTemplate) {
        setSavedTemplates((current) =>
          current.map((item) => (item.id === savedTemplate.id ? savedTemplate : item)),
        );
        setSelectedTemplateId(savedTemplate.id);
        setDraftWidgets(savedTemplate.apply(normalizedWidgets));
        setDraftLayoutCount(savedTemplate.layoutCount);
        setDraftDashboardName(normalizedTemplateName);
      }
      toast.success('Template updated');
      onTemplateSaved?.();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update template.';
      toast.error(message);
      return false;
    } finally {
      setCreatingTemplate(false);
    }
  }

  function renderTemplatePreview(templateId: string) {
    const highlight = selectedTemplateId === templateId;
    return (
      <div className="grid h-20 grid-cols-2 gap-px border border-border bg-input-dark p-1">
        <span className={cn('bg-input', highlight && 'bg-primary-muted')} />
        <span className="bg-input" />
        <span className="bg-panel-light" />
        <span className="bg-panel-light" />
      </div>
    );
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
    setDetailMode('edit');
    setDetailStep('template');
    if (modalOnly) {
      onClose();
    }
  }

  async function saveDetailModal() {
    if (detailMode === 'create') {
      if (!allDetailWidgetSlotsComplete) return;
      const createdTemplate = await createTemplateFromDraft(detailDraftWidgets, detailLayoutCount);
      if (!createdTemplate) return;
      setDetailModalOpen(false);
      setDetailMode('edit');
      if (modalOnly) {
        onClose();
      } else {
        onSave(createdTemplate.widgets);
        onTemplateChange({
          id: createdTemplate.id,
          name: createdTemplate.name,
        });
        onClose();
      }
      return;
    }
    if (modalOnly && templateId) {
      const saved = await updateTemplateFromDraft(detailDraftWidgets, detailLayoutCount);
      if (!saved) return;
      setDetailModalOpen(false);
      if (modalOnly) {
        onClose();
      }
      return;
    }
    const savedTemplateId = getSavedTemplateId(selectedTemplate?.id);
    if (savedTemplateId) {
      const saved = await updateTemplateFromDraft(
        detailDraftWidgets,
        detailLayoutCount,
        savedTemplateId,
        selectedTemplate?.name,
      );
      if (!saved) return;
      const normalizedWidgets = detailDraftWidgets.map(normalizeWidgetTitle);
      setDraftWidgets(normalizedWidgets);
      setDraftLayoutCount(detailLayoutCount);
      setDraftDashboardName(detailTemplateName.trim() || selectedTemplate?.name || 'Untitled');
      setTemplateDirty(false);
      onSave(normalizedWidgets);
      setDetailModalOpen(false);
      onTemplateChange({
        id: `db:${savedTemplateId}`,
        name: detailTemplateName.trim() || selectedTemplate?.name || 'Untitled',
      });
      return;
    }
    saveDetailDraft();
  }

  function goToWidgetStep() {
    setSelectedSlotId((current) => current ?? visibleChartWidgets[0]?.id ?? 'empty:1');
    setDetailStep('widget');
  }

  return (
    <>
      {!modalOnly ? (
        <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-panel-light text-light shadow-2xl">
        <div className="relative flex items-start justify-between overflow-hidden border-b border-primary/30 px-6 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
          <div>
            <h2 className="mt-1 text-3xl font-black text-light drop-shadow-glow-primary">
              Customize dashboard
            </h2>
            {hasSelectedTemplate ? (
            <div className="mt-3 flex max-w-[360px] items-center gap-1 border border-secondary/25 bg-secondary/5 px-2.5 py-1">
              {editingDashboardName ? (
                <input
                  autoFocus
                  value={draftDashboardName}
                  aria-label="Dashboard name"
                  onChange={(event) => {
                    setDraftDashboardName(event.target.value);
                    setTemplateDirty(true);
                  }}
                  onBlur={() => setEditingDashboardName(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs font-black text-secondary outline-none placeholder:text-placeholder"
                  placeholder="Untitled dashboard"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-black text-secondary">
                  {headerTemplateName}
                </span>
              )}
              <button
                type="button"
                aria-label="Rename dashboard"
                title="Rename dashboard"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setEditingDashboardName(true)}
                className={cn('h-6 w-6', drawerIconButtonClass)}
              >
                <PenLine size={13} />
              </button>
            </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close settings"
            title="Close settings"
            className="rounded p-1.5 text-primary hover:bg-primary/10"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left border border-secondary/35 bg-panel p-4 shadow-glow-secondary-soft"
              onClick={() => {
                setDashboardStatusOpen((value) => !value);
                setSidebarLayoutDropdownOpen(false);
              }}
            >
              <span>
                <span className="block font-mono text-lg font-black text-secondary drop-shadow-glow-secondary">
                  Dashboard status
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-muted">
                  Review the current layout and KPI visibility.
                </span>
              </span>
              {dashboardStatusOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-secondary" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-secondary" size={20} />
              )}
            </button>

            {dashboardStatusOpen ? (
              <div className="space-y-5 px-1 pb-2">
                {!hasSelectedTemplate ? (
                  <p className="rounded border border-border bg-input px-3 py-4 font-mono text-xs leading-relaxed text-muted">
                    No template is selected. Choose a template below to populate the dashboard.
                  </p>
                ) : (
                <>
                <div className="space-y-3">
                  <div>
                    <p className="font-mono text-base font-black text-secondary">Layout</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Choose how many chart and table slots this template uses.
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      aria-expanded={sidebarLayoutDropdownOpen}
                      onClick={() => setSidebarLayoutDropdownOpen((value) => !value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-4 rounded-md border bg-input px-4 py-3 text-left transition',
                        sidebarLayoutDropdownOpen
                          ? 'border-secondary/70 shadow-glow-secondary'
                          : 'border-border hover:border-secondary/40',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className="grid h-10 w-10 grid-cols-2 gap-1 rounded border border-secondary/25 bg-secondary/5 p-2">
                          {Array.from({ length: Math.min(sidebarLayoutCount, 4) }, (_, index) => (
                            <span key={index} className="rounded-sm bg-secondary/70" />
                          ))}
                        </span>
                        <span>
                          <span className="block font-mono text-sm font-black text-light">
                            {getLayoutCountLabel(sidebarLayoutCount)}
                          </span>
                          <span className="mt-1 block font-mono text-[11px] text-muted">
                            {sidebarVisibleCharts.length} configured
                          </span>
                        </span>
                      </span>
                      <ChevronDown
                        size={18}
                        className={cn(
                          'shrink-0 text-secondary transition-transform',
                          sidebarLayoutDropdownOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    {sidebarLayoutDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 space-y-1 rounded-md border border-border bg-panel-dark p-2 shadow-2xl">
                        {([2, 3, 4, 5, 6] as LayoutCount[]).map((count) => {
                          const selected = count === sidebarLayoutCount;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                applySidebarLayoutCount(count);
                                setSidebarLayoutDropdownOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded border px-3 py-2.5 font-mono transition',
                                selected
                                  ? 'border-secondary bg-secondary/10 text-secondary'
                                  : 'border-white/10 bg-panel-light text-muted hover:border-secondary/45 hover:text-light',
                              )}
                            >
                              <span className="font-bold">{count}-widget layout</span>
                              {selected ? <Check size={15} /> : <span className="text-[10px] uppercase">{count} slots</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-base font-black text-secondary">Card KPI</p>
                    <span className="font-mono text-xs text-muted">
                      {sidebarKpiWidgets.filter((widget) => widget.visible).length}/{sidebarKpiWidgets.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {summaryOptions.map((option) => {
                      const widget = getKpiWidgetForKind(draftWidgets, option.key);
                      const checked = Boolean(widget);
                      const disabled = !checked && getSelectedKpiKinds(draftWidgets).length >= 3;
                      const Icon = option.icon;
                      return (
                        <div
                          key={option.key}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded border border-border bg-input px-3 py-3 transition',
                            disabled ? 'opacity-45' : 'hover:border-secondary/35',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon size={16} className={checked ? 'text-secondary' : 'text-placeholder'} />
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm font-bold text-light">{option.title}</p>
                              <p className="font-mono text-[11px] text-muted">
                                {checked ? 'Selected' : disabled ? 'Limit reached' : 'Available'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={checked ? `Remove ${option.title}` : `Select ${option.title}`}
                            title={checked ? 'Remove KPI card' : disabled ? 'Remove another KPI first' : 'Select KPI card'}
                            disabled={disabled}
                            onClick={() => {
                              setTemplateDirty(true);
                              setDraftWidgets((current) => applyKpiSelection(current, option.key, !checked));
                            }}
                            className={cn(
                              'h-9 w-9',
                              checked ? drawerIconButtonClass : drawerMutedIconButtonClass,
                              disabled && 'cursor-not-allowed',
                            )}
                          >
                            {checked ? <Check size={17} /> : <Plus size={17} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-base font-black text-secondary">Widgets</p>
                    <span className="font-mono text-xs text-muted">{sidebarVisibleCharts.length}/{getChartWidgets(draftWidgets).length}</span>
                  </div>
                  <div className="space-y-2">
                    {sidebarVisibleCharts.map((widget) => (
                      <div
                        key={widget.id}
                        className="flex items-center justify-between gap-3 rounded border border-border bg-input px-3 py-3 transition hover:border-secondary/35"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-light">{widget.title || getDefaultWidgetTitle(widget)}</p>
                          <p className="font-mono text-[11px] text-muted">
                            Slot {widget.layoutOrder} · {widget.layoutSpan === 2 ? '2 desktop cells' : '1 cell'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            aria-label={widget.layoutSpan === 2 ? `Make ${widget.title || getDefaultWidgetTitle(widget)} half width` : `Make ${widget.title || getDefaultWidgetTitle(widget)} full width`}
                            title={widget.layoutSpan === 2 ? 'Full width. Click for half width.' : 'Half width. Click for full width.'}
                            onClick={() => {
                              setTemplateDirty(true);
                              setDraftWidgets((current) =>
                                updateWidget(current, widget.id, {
                                  layoutSpan: widget.layoutSpan === 2 ? 1 : 2,
                                })
                              );
                            }}
                            className={cn(
                              'h-9 w-9',
                              widget.layoutSpan === 2
                                ? drawerIconButtonClass
                                : drawerMutedIconButtonClass
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
                            aria-label={`Remove ${widget.title || getDefaultWidgetTitle(widget)} from dashboard`}
                            title="Remove widget"
                            onClick={() => removeSidebarWidget(widget.id)}
                            className={cn('h-9 w-9', drawerDangerIconButtonClass)}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-mono text-base font-black text-secondary">Available widgets</p>
                  {sidebarHiddenCharts.length > 0 ? (
                    <div className="space-y-2">
                      {sidebarHiddenCharts.map((widget) => {
                        const isRestoring = restoreWidgetId === widget.id;
                        return (
                          <div
                            key={widget.id}
                            className="rounded border border-border bg-input px-3 py-3 transition hover:border-secondary/35"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-sm font-bold text-light">{widget.title || getDefaultWidgetTitle(widget)}</p>
                                <p className="font-mono text-[11px] text-muted">
                                  {widget.layoutSpan === 2 ? 'Prefers 2 desktop cells' : 'Prefers 1 cell'}
                                </p>
                              </div>
                              <button
                                type="button"
                                title="Add widget"
                                aria-label={`Add ${widget.title || getDefaultWidgetTitle(widget)}`}
                                onClick={() => startRestoreSidebarWidget(widget.id)}
                                className={cn(
                                  'h-9 w-9',
                                  isRestoring ? drawerIconButtonClass : drawerMutedIconButtonClass,
                                )}
                              >
                                <Plus size={17} />
                              </button>
                            </div>

                            {isRestoring ? (
                              <div className="mt-3 border-t border-white/10 pt-3">
                                {sidebarEmptySlots.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {sidebarEmptySlots.map((slot) => (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => restoreSidebarWidget(widget.id, slot)}
                                        className="h-9 border border-secondary/40 bg-secondary/5 font-mono text-xs font-bold text-secondary transition hover:bg-secondary/10"
                                      >
                                        Slot {slot}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="font-mono text-xs text-muted">No open slots.</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded border border-border bg-input px-3 py-3 font-mono text-xs text-muted">
                      No available widgets.
                    </p>
                  )}
                </div>
                </>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left border border-primary/35 bg-input p-4 shadow-glow-primary-soft"
              onClick={() => setTemplateDropdownOpen((value) => !value)}
            >
              <span>
                <span className="block font-mono text-lg font-black text-primary drop-shadow-glow-primary">
                  Templates
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-muted">
                  {selectedTemplate
                    ? `${selectedTemplate.name} · ${getLayoutCountLabel(selectedTemplate.layoutCount)}`
                    : 'Apply a saved template from the database.'}
                </span>
              </span>
              {templateDropdownOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-primary" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-primary" size={20} />
              )}
            </button>

            {templateDropdownOpen ? (
              <div className="space-y-4 px-1 pb-2">
                <label className="flex h-11 items-center gap-2 rounded border border-border bg-input px-3 shadow-glow-primary-soft transition hover:border-primary/60">
                  <Search size={20} className="text-primary" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates"
                    className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-light outline-none placeholder:text-placeholder"
                  />
                </label>

                <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
                  {filteredTemplates.length === 0 ? (
                    <p className="rounded border border-border bg-input px-3 py-4 font-mono text-xs leading-relaxed text-muted">
                      No templates found.
                    </p>
                  ) : null}

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
                          'relative w-full p-3 text-left transition rounded border bg-input',
                          selected
                            ? 'border-primary shadow-glow-primary'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        {selected ? (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-primary text-primary">
                            <Check size={11} />
                          </span>
                        ) : null}
                        {renderTemplatePreview(template.id)}
                        <p className={cn('mt-4 font-mono text-base font-black', selected ? 'text-primary' : 'text-light')}>
                          {template.name}
                        </p>
                        <p className="mt-1 font-mono text-xs tracking-normal text-muted">
                          {template.description}
                        </p>
                        <p className="mt-2 font-mono text-xs font-bold text-secondary">
                          {getLayoutCountLabel(template.layoutCount)}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={openCreateTemplateModal}
                  disabled={creatingTemplate}
                  className="h-12 w-full rounded border border-dashed border-primary/50 bg-transparent font-mono text-sm font-bold text-primary transition hover:bg-primary/10"
                >
                  + Add template
                </button>
              </div>
            ) : null}
          </div>

          <Button
            variant="secondary"
            className="h-12 w-full border-secondary text-secondary hover:bg-secondary/10 disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-input-dark disabled:text-placeholder disabled:opacity-100 disabled:hover:bg-input-dark"
            onClick={openDetailModal}
            disabled={!hasSelectedTemplate}
          >
            Advanced settings
          </Button>
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <Button
            className="h-14 w-full rounded-full border-none bg-gradient-to-r from-primary to-primary-darker text-white shadow-glow-primary"
            onClick={saveAndClose}
            disabled={creatingTemplate}
          >
            Save
          </Button>
        </div>
      </aside>
        </>
      ) : null}

      {detailModalOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={closeDetailModal} />
          <div className="fixed inset-x-4 top-8 z-[70] mx-auto max-h-[calc(100vh-4rem)] w-[min(1080px,calc(100vw-2rem))] overflow-y-auto rounded-md border border-white/10 bg-panel-light text-light shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                  {detailMode === 'create' ? 'Creating template' : 'Advanced settings'}
                </p>
                <h2 className="mt-1 font-mono text-3xl font-black text-light">
                  {detailMode === 'create'
                    ? detailStep === 'template'
                      ? 'Create template'
                      : 'Create widgets'
                    : detailStep === 'template'
                      ? 'Template'
                      : 'Widgets'}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted">
                  {detailStep === 'template'
                    ? detailMode === 'create'
                      ? 'Name, layout, and KPI cards.'
                      : 'Name, layout, and KPI cards.'
                    : 'Slots, data, and display.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close advanced settings"
                title="Close advanced settings"
                className="rounded p-1.5 text-muted hover:bg-white/10 hover:text-white"
                onClick={closeDetailModal}
              >
                <X size={20} />
              </button>
            </div>

            {detailStep === 'template' ? (
              <div className="grid gap-7 px-7 py-7 lg:grid-cols-[280px_1fr]">
                <aside className="rounded-md border border-white/10 bg-panel-dark p-5">
                  <p className="font-mono text-sm font-black text-secondary">
                    {detailMode === 'create' ? 'New template' : 'Current template'}
                  </p>
                  <Field label="Template name">
                    <Input
                      value={detailTemplateName}
                      onChange={(event) => setDetailTemplateName(event.target.value)}
                      placeholder="Untitled"
                    />
                  </Field>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded bg-input p-3">
                      <p className="font-mono text-[10px] uppercase text-placeholder">Layout</p>
                      <p className="mt-1 font-mono text-sm font-black">{getLayoutCountLabel(layoutCount)}</p>
                    </div>
                    <div className="rounded bg-input p-3">
                      <p className="font-mono text-[10px] uppercase text-placeholder">Widgets</p>
                      <p className="mt-1 font-mono text-sm font-black">{visibleChartWidgets.length}/{layoutCount}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-6 text-muted">
                    Template shell. Widget slots stay fixed to the selected count.
                  </p>
                </aside>

                <div className="space-y-7">
                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="font-mono text-lg font-black text-light">Layout</p>
                        <p className="mt-1 text-sm text-muted">Pick the chart/table slot count.</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-5">
                      {[
                        { count: 2, icon: Grid2X2, label: 'Focused' },
                        { count: 3, icon: LayoutGrid, label: 'Simple' },
                        { count: 4, icon: LayoutGrid, label: 'Balanced' },
                        { count: 5, icon: Grid3X3, label: 'Wide' },
                        { count: 6, icon: Grid3X3, label: 'Dense' },
                      ].map((option) => {
                        const Icon = option.icon;
                        const selected = layoutCount === option.count;
                        return (
                          <button
                            key={option.count}
                            type="button"
                            onClick={() => applyLayoutCount(option.count as LayoutCount)}
                            className={cn(
                              'rounded-md border p-3 text-left transition',
                              selected
                                ? 'border-primary bg-primary-darkest text-light shadow-glow-primary'
                                : 'border-white/10 bg-panel-dark text-muted hover:border-white/25 hover:text-light',
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <Icon size={22} className={selected ? 'text-primary-light' : 'text-secondary'} />
                              {selected ? <Check size={16} className="text-primary-light" /> : null}
                            </div>
                            <p className="mt-4 font-mono text-base font-black">{option.count}</p>
                            <p className="mt-1 font-mono text-xs text-muted">{option.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-lg font-black text-light">
                          KPI cards
                        </p>
                        <p className="mt-1 text-sm text-muted">Content and visibility.</p>
                      </div>
                      <span className="font-mono text-[11px] text-placeholder">
                        Summary API fields
                      </span>
                    </div>
                    <div className="mt-3 divide-y divide-white/10 rounded-md border border-white/10 bg-panel-dark">
                      {summaryOptions.map((option) => {
                        const widget = getKpiWidgetForKind(detailDraftWidgets, option.key);
                        const checked = Boolean(widget);
                        const disabled = !checked && getSelectedKpiKinds(detailDraftWidgets).length >= 3;
                        const Icon = option.icon;
                        return (
                          <div key={option.key} className={cn('grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center', disabled && 'opacity-45')}>
                            <div className="flex min-w-0 items-center gap-3">
                              <Icon size={18} className={cn('shrink-0', checked ? 'text-secondary' : 'text-placeholder')} />
                              <div className="min-w-0">
                                <p className="truncate font-bold text-light">{option.title}</p>
                                <p className="mt-1 truncate text-sm text-muted">{checked ? option.description : disabled ? 'Remove another KPI first.' : 'Available KPI card.'}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              {widget ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={widget.info1 ? `Hide description for ${option.title}` : `Show description for ${option.title}`}
                                    title={widget.info1 ? 'Description visible' : 'Description hidden'}
                                    onClick={() => setDetailDraftWidgets((current) => updateWidget(current, widget.id, { info1: !widget.info1 }))}
                                    className={cn(
                                      'h-9 w-9',
                                      widget.info1 ? drawerIconButtonClass : drawerMutedIconButtonClass,
                                    )}
                                  >
                                    <TypeIcon size={16} />
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                aria-label={checked ? `Remove ${option.title}` : `Select ${option.title}`}
                                title={checked ? 'Remove KPI card' : disabled ? 'Remove another KPI first' : 'Select KPI card'}
                                disabled={disabled}
                                onClick={() => setDetailDraftWidgets((current) => applyKpiSelection(current, option.key, !checked))}
                                className={cn(
                                  'h-9 w-9',
                                  checked ? drawerIconButtonClass : drawerMutedIconButtonClass,
                                  disabled && 'cursor-not-allowed',
                                )}
                              >
                                {checked ? <Check size={17} /> : <Plus size={17} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-5">
                    <Button variant="ghost" className="h-11 px-5" onClick={closeDetailModal}>Cancel</Button>
                    <Button variant="secondary" className="h-11 px-6 border-secondary text-secondary" onClick={goToWidgetStep}>
                      Widgets
                    </Button>
                    {detailMode === 'edit' ? (
                      <Button className="h-11 px-6" onClick={saveDetailModal} disabled={creatingTemplate}>
                        Save changes
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="grid gap-7 lg:grid-cols-[300px_1fr]">
                  <div>
                    <p className="font-mono text-lg font-black text-secondary drop-shadow-glow-secondary">
                      Layout map
                    </p>
                    <div className="mt-4 rounded border border-white/10 bg-input-dark p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: layoutCount }).map((_, index) => {
                          const slot = index + 1;
                          const widget = visibleChartWidgets.find((item) => item.layoutOrder === slot);
                          if (!widget) {
                            const selected = selectedEmptySlot === slot;
                            return (
                              <button
                                key={`empty-${slot}`}
                                type="button"
                                onClick={() => setSelectedSlotId(`empty:${slot}`)}
                                className={cn(
                                  'flex min-h-28 flex-col items-center justify-center rounded border border-dashed p-3 transition',
                                  selected
                                    ? 'border-secondary bg-secondary-dark text-secondary shadow-glow-secondary'
                                    : 'border-border bg-panel-light/70 text-placeholder hover:border-secondary/45 hover:text-light',
                                )}
                              >
                                <span className="text-2xl font-black">+</span>
                                <span className="mt-2 font-mono text-xs">Slot {slot}</span>
                                <span className="mt-1 font-mono text-[10px]">Empty</span>
                              </button>
                            );
                          }
                          const selected = selectedSlot?.id === widget.id;
                          return (
                            <button
                              key={widget.id}
                              type="button"
                              onClick={() => setSelectedSlotId(widget.id)}
                              className={cn(
                                'flex min-h-28 flex-col items-center justify-center rounded border bg-border p-3 transition',
                                widget.layoutSpan === 2 && 'col-span-2',
                                selected
                                  ? 'border-primary bg-primary-darkest text-primary shadow-glow-primary'
                                  : 'border-transparent text-muted hover:border-white/20',
                              )}
                            >
                              <span className="text-2xl font-black">{widget.layoutOrder}</span>
                              <span className="mt-2 max-w-full truncate text-xs">{widget.title || getDefaultWidgetTitle(widget)}</span>
                              {widget.layoutSpan === 2 ? <span className="mt-1 font-mono text-[10px] text-secondary">2 desktop cells</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-2xl font-black text-light">
                        Slot {selectedSlot?.layoutOrder ?? selectedEmptySlot ?? 1} settings
                      </p>
                      {selectedSlot ? (
                        <button
                          type="button"
                          title="Clear slot"
                          aria-label={`Clear ${selectedSlot.title || getDefaultWidgetTitle(selectedSlot)}`}
                          onClick={() => clearDetailSlot(selectedSlot.id)}
                          className={cn('h-9 w-9', drawerDangerIconButtonClass)}
                        >
                          <X size={17} />
                        </button>
                      ) : null}
                    </div>
                    {selectedEmptySlot ? (
                      <div className="mt-4 rounded border border-secondary/45 bg-input-dark p-5">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-lg font-black text-secondary">Empty slot</p>
                          <span className="font-mono text-xs text-muted">{availableChartWidgets.length}</span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {savedPresets.length > 0 ? (
                            <>
                              <p className="font-mono text-xs font-black text-secondary">
                                Create from preset
                              </p>
                              {savedPresets.map((preset) => (
                                <button
                                  key={preset.preset_id}
                                  type="button"
                                  onClick={() => createDetailWidgetFromPreset(selectedEmptySlot, preset)}
                                  className="flex w-full items-center justify-between gap-4 rounded-md border border-secondary/25 bg-secondary/5 px-4 py-3 text-left transition hover:border-secondary/60 hover:bg-secondary/10"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-sm font-black text-light">
                                      {preset.preset_name || `Preset ${preset.preset_id}`}
                                    </span>
                                    <span className="mt-1 block font-mono text-xs text-muted">
                                      {preset.chart_type} · reusable preset
                                    </span>
                                  </span>
                                  <Plus size={18} className="shrink-0 text-secondary" />
                                </button>
                              ))}
                            </>
                          ) : null}

                          <p className="pt-2 font-mono text-xs font-black text-primary-light">
                            Create custom preset
                          </p>
                          <button
                            type="button"
                            title="Create widget"
                            aria-label={`Create widget in slot ${selectedEmptySlot}`}
                            onClick={() => createDetailWidget(selectedEmptySlot)}
                            className="flex w-full items-center justify-between gap-4 rounded-md border border-primary/45 bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-sm font-black text-light">
                                New preset
                              </span>
                              <span className="mt-1 block font-mono text-xs text-muted">
                                Line chart · 1 cell
                              </span>
                            </span>
                            <Plus size={18} className="shrink-0 text-primary-light" />
                          </button>

                          {availableChartWidgets.length > 0 ? (
                            <p className="pt-2 font-mono text-xs font-black text-secondary">Available widgets</p>
                          ) : null}

                          {availableChartWidgets.length > 0 ? (
                            availableChartWidgets.map((widget) => (
                              <button
                                key={widget.id}
                                type="button"
                                title={`Add ${widget.title || getDefaultWidgetTitle(widget)}`}
                                aria-label={`Add ${widget.title || getDefaultWidgetTitle(widget)}`}
                                onClick={() => restoreDetailWidget(widget.id, selectedEmptySlot)}
                                className="flex w-full items-center justify-between gap-4 rounded-md border border-white/10 bg-panel-light px-4 py-3 text-left transition hover:border-secondary/50 hover:bg-secondary-dark"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-mono text-sm font-black text-light">
                                    {widget.title || getDefaultWidgetTitle(widget)}
                                  </span>
                                  <span className="mt-1 block font-mono text-xs text-muted">
                                    {widget.chartType} · prefers {widget.layoutSpan === 2 ? '2 cells' : '1 cell'}
                                  </span>
                                </span>
                                <Plus size={18} className="shrink-0 text-secondary" />
                              </button>
                            ))
                          ) : (
                            <p className="pt-2 font-mono text-xs text-muted">No available widgets.</p>
                          )}
                        </div>
                      </div>
                    ) : selectedSlot ? (
                      <div className="mt-4 rounded border border-primary/70 bg-input-dark p-6">
                        <div className="grid gap-4">
                          {savedPresets.length > 0 ? (
                            <Field label="Start from preset" hint="Selecting a preset fills this widget's saved configuration.">
                              <Select
                                value={selectedSlot.preset.startsWith('preset:') ? selectedSlot.preset.replace('preset:', '') : ''}
                                onChange={(event) => {
                                  const presetId = Number(event.target.value);
                                  if (presetId) applyDetailPreset(selectedSlot.id, presetId);
                                }}
                              >
                                <option value="">Custom configuration</option>
                                {savedPresets.map((preset) => (
                                  <option key={preset.preset_id} value={preset.preset_id}>
                                    {preset.preset_name || `Preset ${preset.preset_id}`}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          ) : null}

                          <Field label="Preset name" hint="Saving changes updates the preset name shown on this widget.">
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

                          <Field label="Preset chart type">
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
                            <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
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
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-input text-muted hover:border-primary/60',
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 font-mono text-xs text-placeholder">
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
                            <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
                              {selectedSlot.chartType === 'table' ? 'Table columns' : 'Display options'}
                            </p>
                            {selectedSlot.chartType === 'table' ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, { tableColumns: defaultTableColumns }),
                                      )
                                    }
                                  >
                                    Default
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, { tableColumns: [] }),
                                      )
                                    }
                                  >
                                    Deselect all
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      setDetailDraftWidgets((current) =>
                                        updateWidget(current, selectedSlot.id, {
                                          tableColumns: tableColumnOptions.map((item) => item.value),
                                        }),
                                      )
                                    }
                                  >
                                    Select all
                                  </Button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {tableColumnOptions.map((option) => {
                                    const selectedColumns = selectedSlot.tableColumns ?? defaultTableColumns;
                                    const checked = selectedColumns.includes(option.value);
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          setDetailDraftWidgets((current) =>
                                            updateWidget(current, selectedSlot.id, {
                                              tableColumns: checked
                                                ? selectedColumns.filter((item) => item !== option.value)
                                                : [...selectedColumns, option.value],
                                            }),
                                          )
                                        }
                                        className={cn(
                                          'flex items-center justify-between border p-3 text-left font-mono text-sm transition',
                                          checked
                                            ? 'border-secondary/40 bg-secondary/5 text-light'
                                            : 'border-border bg-input text-muted',
                                        )}
                                      >
                                        <span>{option.label}</span>
                                        <span
                                          className={cn(
                                            'flex h-5 w-5 items-center justify-center rounded transition',
                                            checked ? 'bg-secondary text-input-dark' : 'border border-white/20',
                                          )}
                                        >
                                          {checked ? <Check size={13} strokeWidth={3} /> : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
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
                                        ? 'border-secondary/40 bg-secondary/5 text-light'
                                        : 'border-border bg-input text-muted',
                                    )}
                                  >
                                    <span>{option.label}</span>
                                    <span
                                      className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded transition',
                                        option.checked ? 'bg-secondary text-input-dark' : 'border border-white/20',
                                      )}
                                    >
                                      {option.checked ? <Check size={13} strokeWidth={3} /> : null}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            {selectedSlot.chartType === 'heatmap' && selectedSlot.heatmapMode === 'calendar' ? (
                              <>
                                <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
                                  Year
                                </p>
                                <p className="mb-4 border border-border bg-input px-3 py-2 font-mono text-xs text-light">
                                  {getYearFromDate(selectedSlot.startDate) === String(new Date().getFullYear())
                                    ? `${getYearFromDate(selectedSlot.startDate)} · Jan 1 to today`
                                    : `${getYearFromDate(selectedSlot.startDate)} · Jan 1 to Dec 31`}
                                </p>
                                <Field label="Year" labelVariant="nested">
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
                                <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
                                  Time range
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label="Start date" labelVariant="nested">
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
                                  <Field label="End date" labelVariant="nested">
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
                    <Button
                      className="h-11 px-6 disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-input-dark disabled:text-placeholder disabled:opacity-100"
                      onClick={saveDetailModal}
                      disabled={creatingTemplate || (detailMode === 'create' && !allDetailWidgetSlotsComplete)}
                      title={
                        detailMode === 'create' && !allDetailWidgetSlotsComplete
                          ? `Complete all ${detailLayoutCount} widget slots before creating the template.`
                          : undefined
                      }
                    >
                      {detailMode === 'create' ? (creatingTemplate ? 'Creating...' : 'Create template') : 'Save changes'}
                    </Button>
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

export function TemplateEditorModal({
  isOpen,
  mode,
  widgets,
  templateId,
  templateName,
  onClose,
  onSaved,
}: TemplateEditorModalProps) {
  return (
    <GeneralSettingsDrawer
      isOpen={isOpen}
      widgets={widgets}
      activeTemplate={null}
      variant="modal"
      templateId={mode === 'edit' ? templateId : undefined}
      templateName={mode === 'edit' ? templateName : undefined}
      onClose={onClose}
      onSave={() => undefined}
      onTemplateChange={() => undefined}
      onTemplateSaved={onSaved}
    />
  );
}
