import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Maximize2,
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
  type GroupBy,
  type Metric,
  type TimeBucket,
} from '../../../services/generated/nettrace-api';
import { cn } from '../../../utils/cn';
import { decodeTableColumns } from '../../../utils/columns';
import { normalizePresetFieldsByChartType } from '../../../utils/presetPayload';
import type { WidgetKind, WidgetSettingsValues } from './WidgetSettingsDrawer';
import { DatePicker, WeekPicker, getWeekRangeForDateValue } from './WeekPicker';

export type DashboardWidgetConfig = WidgetSettingsValues & {
  id: string;
  title: string;
  type: WidgetKind;
  layoutOrder: number;
  layoutSpan: 1 | 2;
};

type LayoutCount = 1 | 2 | 3 | 4 | 5 | 6;

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  layoutCount: LayoutCount;
  kpiCount: number;
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
  onTemplateSaved?: (saved: { id: string; name: string; widgets: DashboardWidgetConfig[] }) => void;
}

interface TemplateEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  widgets: DashboardWidgetConfig[];
  templateId?: number;
  templateName?: string;
  onClose: () => void;
  onSaved?: (saved: { id: string; name: string; widgets: DashboardWidgetConfig[] }) => void;
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

const DEFAULT_TABLE_RECORD_LIMIT = 15;
const DEFAULT_TABLE_TOTAL_RECORDS = 200;
const MAX_TABLE_RECORD_LIMIT = 200;
const MAX_TABLE_TOTAL_RECORDS = 1000;

function normalizeTablePageSize(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_RECORD_LIMIT;
  return Math.min(MAX_TABLE_RECORD_LIMIT, Math.max(1, Math.trunc(numericValue)));
}

function normalizeTableRecordLimit(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_TOTAL_RECORDS;
  return Math.min(MAX_TABLE_TOTAL_RECORDS, Math.max(1, Math.trunc(numericValue)));
}

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
    const heatmapMode = current.heatmapMode ?? 'weekday';
    const dateRange = heatmapMode === 'calendar'
      ? getYearDateRange(getYearFromDate(current.startDate))
      : getWeekRangeForDateValue(current.startDate);
    return { chartType, groupBy: 'none', heatmapMode, layoutSpan: 2, ...dateRange };
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
      startDate: '',
      endDate: '',
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

function toDateInputValue(value: string) {
  return value?.slice(0, 10) || '';
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
  return Math.min(6, Math.max(1, visibleCount)) as LayoutCount;
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

function getReusablePresetId(widget: DashboardWidgetConfig) {
  if (!widget.preset?.startsWith('preset:')) return null;
  const id = Number(widget.preset.replace('preset:', ''));
  return Number.isFinite(id) ? id : null;
}

function getPresetDisplayName(preset: PresetSummary) {
  return preset.preset_name || `Preset ${preset.preset_id}`;
}

function getNextPresetName(baseName: string, existingNames: Set<string>) {
  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!existingNames.has(candidate)) return candidate;
  }

  return `${baseName} ${Date.now()}`;
}

function isWidgetSameAsPreset(widget: DashboardWidgetConfig, preset: PresetSummary) {
  const chartType = normalizeTemplateChartType(preset.chart_type);
  const widgetFields = normalizePresetFieldsByChartType({
    chartType: widget.chartType,
    metric: widget.metric,
    groupBy: widget.groupBy,
    timeBucket: widget.timeBucket,
    heatmapMode: widget.heatmapMode,
    tableColumns: widget.tableColumns,
    tablePageSize: widget.tablePageSize,
    tableRecordLimit: widget.tableRecordLimit,
  });
  const presetFields = normalizePresetFieldsByChartType({
    chartType,
    metric: preset.metric,
    groupBy: preset.group_by,
    timeBucket: preset.time_bucket,
    heatmapMode: preset.heatmap_mode,
    tableColumns: preset.table_columns,
    tablePageSize: preset.table_page_size,
    tableRecordLimit: preset.table_record_limit,
  });
  return (
    (widget.title || getDefaultWidgetTitle(widget)).trim() === getPresetDisplayName(preset) &&
    widget.chartType === chartType &&
    widgetFields.metric === presetFields.metric &&
    widgetFields.group_by === presetFields.group_by &&
    widgetFields.time_bucket === presetFields.time_bucket &&
    widgetFields.heatmap_mode === presetFields.heatmap_mode &&
    widgetFields.table_columns === presetFields.table_columns &&
    widgetFields.table_page_size === presetFields.table_page_size &&
    widgetFields.table_record_limit === presetFields.table_record_limit
  );
}

function findMatchingPresetForWidget(
  widget: DashboardWidgetConfig,
  reusablePresets: PresetSummary[],
) {
  return reusablePresets.find((preset) => isWidgetSameAsPreset(widget, preset)) ?? null;
}

export function buildTemplateWidgetInputs(
  widgets: DashboardWidgetConfig[],
  reusablePresets: PresetSummary[] = [],
): TemplateWidgetInput[] {
  const reservedPresetNames = new Set(
    reusablePresets
      .map((preset) => preset.preset_name?.trim())
      .filter((name): name is string => Boolean(name)),
  );

  return getVisibleChartWidgets(widgets).map((widget) => {
    const matchedPreset = getReusablePresetId(widget)
      ? null
      : findMatchingPresetForWidget(widget, reusablePresets);
    const presetId = getReusablePresetId(widget) ?? matchedPreset?.preset_id ?? null;
    const sourcePreset = presetId
      ? reusablePresets.find((preset) => preset.preset_id === presetId)
      : null;

    if (presetId) {
      if (sourcePreset && !isWidgetSameAsPreset(widget, sourcePreset)) {
        const sourceName = getPresetDisplayName(sourcePreset);
        const currentTitle = (widget.title || '').trim();
        const presetName = currentTitle && currentTitle !== sourceName
          ? currentTitle
          : getNextPresetName(sourceName, reservedPresetNames);
        reservedPresetNames.add(presetName);

        return {
          preset_name: presetName,
          position: widget.layoutOrder,
          chart_type: widget.chartType,
          start_date: widget.startDate || null,
          end_date: widget.endDate || null,
          ...normalizePresetFieldsByChartType({
            chartType: widget.chartType,
            metric: widget.metric,
            groupBy: widget.groupBy,
            timeBucket: widget.timeBucket,
            heatmapMode: widget.heatmapMode,
            tableColumns: widget.tableColumns,
            tablePageSize: widget.tablePageSize,
            tableRecordLimit: widget.tableRecordLimit,
          }),
        };
      }

      return {
        preset_id: presetId,
        position: widget.layoutOrder,
        start_date: widget.startDate || null,
        end_date: widget.endDate || null,
      };
    }

    return {
      preset_name: widget.title || getDefaultWidgetTitle(widget),
      position: widget.layoutOrder,
      chart_type: widget.chartType,
      start_date: widget.startDate || null,
      end_date: widget.endDate || null,
      ...normalizePresetFieldsByChartType({
        chartType: widget.chartType,
        metric: widget.metric,
        groupBy: widget.groupBy,
        timeBucket: widget.timeBucket,
        heatmapMode: widget.heatmapMode,
        tableColumns: widget.tableColumns,
        tablePageSize: widget.tablePageSize,
        tableRecordLimit: widget.tableRecordLimit,
      }),
    };
  });
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

function countVisibleKpiCards(widgets: DashboardWidgetConfig[]) {
  return widgets.filter((widget) => widget.type.startsWith('kpi') && widget.visible).length;
}

function countLegacySelectedCards(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.length : null;
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
    kpiCount: countVisibleKpiCards(snapshot.widgets),
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

type HeatmapMode = 'weekday' | 'calendar';

function normalizeMetric(value: string | null | undefined): Metric {
  if (value === 'count' || value === 'avg_duration' || value === 'max_duration' || value === 'affected_devices') {
    return value;
  }
  return 'count';
}

function normalizeGroupBy(value: string | null | undefined): 'none' | GroupBy {
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

function normalizeTimeBucket(value: string | null | undefined): TimeBucket {
  if (value === 'hour' || value === 'day' || value === 'week' || value === 'month' || value === 'year') {
    return value;
  }
  return 'day';
}

function normalizeHeatmapMode(value: string | null | undefined): HeatmapMode {
  if (value === 'weekday' || value === 'calendar') {
    return value;
  }
  return 'weekday';
}

function normalizeTableColumns(value: string | null | undefined): ExportColumn[] | undefined {
  return decodeTableColumns(value);
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
    groupBy: normalizeGroupBy(preset.group_by),
    metric: normalizeMetric(preset.metric),
    timeBucket: normalizeTimeBucket(preset.time_bucket),
    heatmapMode: normalizeHeatmapMode(preset.heatmap_mode),
    tableColumns: normalizeTableColumns(preset.table_columns),
    tablePageSize: preset.table_page_size ?? widget.tablePageSize ?? widget.tableRecordLimit ?? DEFAULT_TABLE_RECORD_LIMIT,
    tableRecordLimit: preset.table_record_limit ?? widget.tableRecordLimit ?? DEFAULT_TABLE_TOTAL_RECORDS,
    layoutSpan: chartType === 'table' || chartType === 'heatmap' ? 2 : 1,
    startDate: widget.startDate,
    endDate: widget.endDate,
  };
}

function applyTemplateWidgetsFromDb(
  sourceWidgets: DashboardWidgetConfig[],
  templateWidgets: TemplateWidgetDetail[],
) {
  const orderedTemplateWidgets = [...templateWidgets].sort(
    (a, b) => a.position - b.position || a.widget_id - b.widget_id,
  );
  const chartSlots = getChartWidgets(sourceWidgets);
  const visibleCount = Math.min(Math.max(orderedTemplateWidgets.length, 1), 6) as LayoutCount;
  const updatesById = new Map<string, Partial<DashboardWidgetConfig>>();

  orderedTemplateWidgets.slice(0, chartSlots.length).forEach((templateWidget, index) => {
    const slot = chartSlots[index];
    const chartType = normalizeTemplateChartType(templateWidget.preset.chart_type);
    updatesById.set(slot.id, {
      title: templateWidget.preset.preset_name || `Preset ${templateWidget.preset.preset_id}`,
      preset: `preset:${templateWidget.preset.preset_id}`,
      visible: true,
      layoutOrder: templateWidget.position || index + 1,
      chartType,
      groupBy: normalizeGroupBy(templateWidget.preset.group_by),
      metric: normalizeMetric(templateWidget.preset.metric),
      timeBucket: normalizeTimeBucket(templateWidget.preset.time_bucket),
      heatmapMode: normalizeHeatmapMode(templateWidget.preset.heatmap_mode),
      tableColumns: normalizeTableColumns(templateWidget.preset.table_columns),
      tablePageSize: templateWidget.preset.table_page_size ?? slot.tablePageSize ?? slot.tableRecordLimit ?? DEFAULT_TABLE_RECORD_LIMIT,
      tableRecordLimit: templateWidget.preset.table_record_limit ?? slot.tableRecordLimit ?? DEFAULT_TABLE_TOTAL_RECORDS,
      layoutSpan: chartType === 'table' || chartType === 'heatmap' ? 2 : 1,
      startDate: normalizeTemplateDate(templateWidget.start_date, slot.startDate || ''),
      endDate: normalizeTemplateDate(templateWidget.end_date, slot.endDate || ''),
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
            widget.position,
            widget.preset.preset_name || `Preset ${widget.preset.preset_id}`,
          ]),
        );
        const widgetsWithPresetLinks = applyTemplateWidgetsFromDb(snapshot.widgets, template.widgets);
        return widgetsWithPresetLinks.map((widget) => {
          if (widget.type.startsWith('kpi')) return widget;
          const presetName = presetNamesByPosition.get(widget.layoutOrder);
          return presetName ? { ...widget, title: presetName } : widget;
        });
      },
    };
  }

  const layoutCount = Math.min(Math.max(template.widgets.length, 1), 6) as LayoutCount;
  return {
    id: `db:${template.template_id}`,
    name: getSavedTemplateName(template),
    description: 'POSTGRES / SAVED_LAYOUT',
    layoutCount,
    kpiCount: countLegacySelectedCards(template.selected_cards) ?? 0,
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
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [savedPresets, setSavedPresets] = useState<PresetSummary[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateWidgetFilter, setTemplateWidgetFilter] = useState('all');
  const [templateKpiFilter, setTemplateKpiFilter] = useState('all');
  const [draftTemplateName, setDraftTemplateName] = useState(getDraftTemplateName);
  const [detailTemplateName, setDetailTemplateName] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<'edit' | 'create'>('edit');
  const [detailStep, setDetailStep] = useState<'template' | 'widget'>('template');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [detailLayoutCount, setDetailLayoutCount] = useState<LayoutCount>(getLayoutCapacity(widgets));

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
      setTemplateWidgetFilter('all');
      setTemplateKpiFilter('all');
      setDraftTemplateName(getDraftTemplateName());
      setDetailTemplateName('');
      setDetailModalOpen(false);
      setDetailMode('edit');
      setDetailStep('template');
      setSelectedSlotId(null);
      setDetailLayoutCount(getLayoutCapacity(widgets));
    }
  }, [activeTemplate?.id, activeTemplate?.name, isOpen, widgets]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setTemplatesLoading(true);
    setSavedTemplates([]);

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
                layoutCount: Math.min(Math.max(template.number_of_widgets || 1, 1), 6) as LayoutCount,
                kpiCount: countLegacySelectedCards(template.selected_cards) ?? 0,
                apply: (currentWidgets: DashboardWidgetConfig[]) =>
                  withVisibleChartCount(currentWidgets, Math.min(Math.max(template.number_of_widgets || 1, 1), 6) as LayoutCount),
              };
            }
          }),
        );
        if (cancelled) return;
        setSavedTemplates(parsedTemplates);
      } catch {
        if (!cancelled) setSavedTemplates([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
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
  const chartWidgets = getChartWidgets(detailDraftWidgets);
  const visibleChartWidgets = getVisibleChartWidgets(detailDraftWidgets);
  const allDetailWidgetSlotsComplete = visibleChartWidgets.length === detailLayoutCount;
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
  const filteredTemplates = allTemplates.filter((template) => {
    const matchesSearch = `${template.name} ${template.description}`.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesWidgets = templateWidgetFilter === 'all' || template.layoutCount === Number(templateWidgetFilter);
    const matchesKpis = templateKpiFilter === 'all' || template.kpiCount === Number(templateKpiFilter);
    return matchesSearch && matchesWidgets && matchesKpis;
  });

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

  function clearDetailSlot(widgetId: string) {
    setDetailDraftWidgets((current) => {
      const nextWidgets = hideChartWidget(current, widgetId);
      const nextEmptySlot = Math.min(detailLayoutCount, getVisibleChartWidgets(nextWidgets).length + 1);
      setSelectedSlotId(`empty:${nextEmptySlot}`);
      return nextWidgets;
    });
  }

  function createDetailWidget(slot: number) {
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
      tablePageSize: DEFAULT_TABLE_RECORD_LIMIT,
      tableRecordLimit: DEFAULT_TABLE_TOTAL_RECORDS,
      preset: 'custom',
      startDate: '',
      endDate: '',
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
      tablePageSize: DEFAULT_TABLE_RECORD_LIMIT,
      tableRecordLimit: DEFAULT_TABLE_TOTAL_RECORDS,
      preset: `preset:${preset.preset_id}`,
      startDate: '',
      endDate: '',
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
    setDetailModalOpen(true);
  }

  function saveDetailDraft() {
    const normalizedWidgets = detailDraftWidgets.map(normalizeWidgetTitle);
    setDraftWidgets(normalizedWidgets);
    setDraftLayoutCount(detailLayoutCount);
    setSelectedTemplateId('none');
    onTemplateChange(null);
    setDetailModalOpen(false);
    onSave(normalizedWidgets);
    onClose();
  }

  async function createTemplateFromDraft(sourceWidgets = draftWidgets, sourceLayoutCount = draftLayoutCount) {
    setCreatingTemplate(true);
    try {
      const normalizedWidgets = sourceWidgets.map(normalizeWidgetTitle);
      const normalizedTemplateName = detailTemplateName.trim() || 'Untitled';
      const created = await nettraceApi.createTemplate({
        name: normalizedTemplateName,
        selected_cards: buildTemplateSnapshot(normalizedWidgets, sourceLayoutCount),
        widgets: buildTemplateWidgetInputs(normalizedWidgets, savedPresets),
      });
      const detail = await nettraceApi.getTemplateDetail(created.data.template_id);
      const savedTemplate = createDashboardTemplateFromDetail(detail.data);
      if (savedTemplate) {
        setSavedTemplates((current) => [savedTemplate, ...current]);
        setSelectedTemplateId(savedTemplate.id);
        setDraftWidgets(savedTemplate.apply(normalizedWidgets));
        setDraftLayoutCount(savedTemplate.layoutCount);
        setDetailTemplateName('');
      }
      toast.success('Template saved');
      onTemplateSaved?.({
        id: `db:${created.data.template_id}`,
        name: normalizedTemplateName,
        widgets: normalizedWidgets,
      });
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
        widgets: buildTemplateWidgetInputs(normalizedWidgets, savedPresets),
      });
      const detail = await nettraceApi.getTemplateDetail(updated.data.template_id);
      const savedTemplate = createDashboardTemplateFromDetail(detail.data);
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
      onTemplateSaved?.({
        id: `db:${targetTemplateId}`,
        name: normalizedTemplateName,
        widgets: normalizedWidgets,
      });
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
      onClose();
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
        <div className="relative overflow-hidden border-b border-primary/30 px-6 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
          <div className="flex items-start justify-between gap-4">
            <h2 className="mt-1 text-3xl font-black text-light drop-shadow-glow-primary">
              Templates
            </h2>
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

          {hasSelectedTemplate ? (
            <div className="mt-3 flex items-center gap-1 border border-secondary/25 bg-secondary/5 px-2.5 py-1">
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
                className={cn('h-10 w-10', drawerIconButtonClass)}
              >
                <PenLine size={13} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <label className="flex h-11 items-center gap-2 rounded border border-border bg-input px-3 shadow-glow-primary-soft transition hover:border-primary/60">
            <Search size={20} className="text-primary" />
            <input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search templates"
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-light outline-none placeholder:text-placeholder"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Widgets" labelVariant="nested">
              <Select
                value={templateWidgetFilter}
                onChange={(event) => setTemplateWidgetFilter(event.target.value)}
              >
                <option value="all">All widget counts</option>
                {([1, 2, 3, 4, 5, 6] as LayoutCount[]).map((count) => (
                  <option key={count} value={String(count)}>
                    Only {count} {count === 1 ? 'widget' : 'widgets'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="KPI cards" labelVariant="nested">
              <Select
                value={templateKpiFilter}
                onChange={(event) => setTemplateKpiFilter(event.target.value)}
              >
                <option value="all">All KPI counts</option>
                {Array.from({ length: summaryOptions.length + 1 }, (_, count) => (
                  <option key={count} value={String(count)}>
                    Only {count} KPI {count === 1 ? 'card' : 'cards'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-4 overflow-y-auto pr-1">
            {templatesLoading ? (
              <p className="rounded border border-border bg-input px-3 py-4 font-mono text-xs leading-relaxed text-muted">
                Loading templates...
              </p>
            ) : null}

            {!templatesLoading && filteredTemplates.length === 0 ? (
              <p className="rounded border border-border bg-input px-3 py-4 font-mono text-xs leading-relaxed text-muted">
                No templates found.
              </p>
            ) : null}

            {!templatesLoading && filteredTemplates.map((template) => {
              const selected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    applyTemplate(template.id);
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
                    {getLayoutCountLabel(template.layoutCount)} · {template.kpiCount} KPI {template.kpiCount === 1 ? 'card' : 'cards'}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={openCreateTemplateModal}
              disabled={creatingTemplate}
              className="h-12 w-full rounded border border-dashed border-primary/50 bg-transparent font-mono text-sm font-bold text-primary transition hover:bg-primary/10"
            >
              + Add template
            </button>
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
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={closeDetailModal}>
            <div
              className="relative flex max-h-[90vh] w-full max-w-[800px] flex-col rounded-md border border-white/10 bg-panel-light text-light shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
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
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-7 py-7">
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
                    <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3">
                      {[
                        { count: 1, icon: Maximize2, label: 'Hero' },
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

                  </div>
                </div>
              </div>

                <div className="mt-auto flex items-center justify-end gap-3 border-t border-white/10 px-7 py-4 bg-panel-light/95 sticky bottom-0">
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
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-6">
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
                                    : getWeekRangeForDateValue(selectedSlot.startDate);
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
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <Field label="Records per page" labelVariant="nested">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={MAX_TABLE_RECORD_LIMIT}
                                      value={selectedSlot.tablePageSize ?? selectedSlot.tableRecordLimit ?? DEFAULT_TABLE_RECORD_LIMIT}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(current, selectedSlot.id, {
                                            tablePageSize: normalizeTablePageSize(event.target.value),
                                          }),
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="Number of records" labelVariant="nested">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={MAX_TABLE_TOTAL_RECORDS}
                                      value={selectedSlot.tableRecordLimit ?? DEFAULT_TABLE_TOTAL_RECORDS}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(current, selectedSlot.id, {
                                            tableRecordLimit: normalizeTableRecordLimit(event.target.value),
                                          }),
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
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
                            ) : selectedSlot.chartType === 'heatmap' && selectedSlot.heatmapMode === 'weekday' ? (
                              <>
                                <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
                                  Week
                                </p>
                                <div className="grid gap-4">
                                  <Field label="" labelVariant="nested">
                                    <WeekPicker
                                      value={selectedSlot.startDate}
                                      onChange={(range) => {
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(current, selectedSlot.id, range),
                                        );
                                      }}
                                    />
                                  </Field>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="mb-3 font-mono text-base font-black tracking-normal text-medium">
                                  Time range
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label="Start date" labelVariant="nested">
                                    <DatePicker
                                      value={toDateInputValue(selectedSlot.startDate)}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(
                                            current,
                                            selectedSlot.id,
                                            { startDate: event },
                                          ),
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="End date" labelVariant="nested">
                                    <DatePicker
                                      value={toDateInputValue(selectedSlot.endDate)}
                                      onChange={(event) =>
                                        setDetailDraftWidgets((current) =>
                                          updateWidget(
                                            current,
                                            selectedSlot.id,
                                            { endDate: event },
                                          ),
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
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-white/10 px-6 py-4 bg-panel-light/95 sticky bottom-0">
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
