import { format, parseISO } from 'date-fns';
import { BarChart3, Check, Eye, EyeOff, Grid, Maximize2, Minimize2, PenLine, PieChart, Table, TrendingUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { ExportColumn, GroupBy, Metric, TimeBucket } from '../../../services/generated/nettrace-api';

type HeatmapMode = 'weekday' | 'calendar';

const drawerIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-secondary transition hover:text-secondary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30';

const drawerMutedIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-muted transition hover:text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30';

const drawerDangerIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-primary-light transition hover:text-primary-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export type WidgetKind =
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

export interface WidgetSettingsValues {
  title?: string;
  visible: boolean;
  chartType: 'line' | 'bar' | 'pie' | 'table' | 'heatmap';
  metric: Metric;
  groupBy: 'none' | GroupBy;
  timeBucket: TimeBucket;
  heatmapMode: HeatmapMode;
  info1: boolean;
  info2: boolean;
  info3: boolean;
  tableColumns?: ExportColumn[];
  preset: string;
  startDate: string;
  endDate: string;
  layoutSpan?: 1 | 2;
}

export interface WidgetPresetOption {
  id: string;
  label: string;
  values: WidgetSettingsValues;
}

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

interface WidgetSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (values: WidgetSettingsValues) => void;
  initialValues: WidgetSettingsValues;
  widgetTitle: string;
  widgetKind: WidgetKind;
  presets?: WidgetPresetOption[];
}

function formatDisplayDate(value: string) {
  if (!value) return 'Not set';
  try {
    return format(parseISO(value), 'dd/MM/yyyy');
  } catch {
    return value;
  }
}

const metricLabels: Record<Metric, string> = {
  count: 'Alarm count',
  avg_duration: 'Avg handling time',
  max_duration: 'Max handling time',
  affected_devices: 'Affected devices',
};

function getDefaultWidgetTitle(values: WidgetSettingsValues) {
  const from = formatDisplayDate(values.startDate);
  const to = formatDisplayDate(values.endDate);
  const dataLabel =
    values.chartType === 'table'
      ? 'Alarm table'
      : values.chartType === 'heatmap'
        ? 'Alarm heatmap'
        : metricLabels[values.metric] ?? 'Widget';

  return `${dataLabel} · ${from} - ${to}`;
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

export function WidgetSettingsDrawer({
  isOpen,
  onClose,
  onApply,
  initialValues,
  widgetKind,
  widgetTitle,
  presets = [],
}: WidgetSettingsDrawerProps) {
  const { register, handleSubmit, setValue, watch, reset, getValues } = useForm<WidgetSettingsValues>({
    defaultValues: initialValues,
    shouldUnregister: false,
  });
  const [editingWidgetName, setEditingWidgetName] = useState(false);

  const title = watch('title');
  const selectedPreset = watch('preset');
  const selectedPresetValue = presets.some((preset) => preset.id === selectedPreset) ? selectedPreset : '';
  const visible = watch('visible');
  const selectedChartType = watch('chartType');
  const selectedGroupBy = watch('groupBy');
  const selectedHeatmapMode = watch('heatmapMode');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const info1 = watch('info1');
  const info2 = watch('info2');
  const info3 = watch('info3');
  const tableColumns = watch('tableColumns') ?? defaultTableColumns;
  const layoutSpan = watch('layoutSpan') || 1;

  // Reset form when active widget changes or drawer opens
  useEffect(() => {
    reset(initialValues);
    setEditingWidgetName(false);
  }, [initialValues, reset, isOpen]);

  if (!isOpen) return null;

  function onSubmit(values: WidgetSettingsValues) {
    const selectedGroup = values.groupBy ?? initialValues.groupBy;
    const calendarRange = values.chartType === 'heatmap' && values.heatmapMode === 'calendar'
      ? getYearDateRange(getYearFromDate(values.startDate || initialValues.startDate))
      : null;
    const normalizedValues = {
      ...values,
      startDate: calendarRange?.startDate ?? (values.startDate || initialValues.startDate || '2026-06-01'),
      endDate: calendarRange?.endDate ?? (values.endDate || initialValues.endDate || '2026-06-30'),
      metric: values.metric ?? initialValues.metric,
      timeBucket: values.timeBucket ?? initialValues.timeBucket,
      heatmapMode: values.heatmapMode ?? initialValues.heatmapMode ?? 'weekday',
      tableColumns:
        values.chartType === 'table'
          ? values.tableColumns && values.tableColumns.length > 0
            ? values.tableColumns
            : defaultTableColumns
          : values.tableColumns,
      groupBy: values.chartType === 'line' || values.chartType === 'table' || values.chartType === 'heatmap'
        ? 'none'
        : values.chartType === 'pie' && selectedGroup === 'none'
          ? 'severity'
          : selectedGroup,
    };
    normalizedValues.title = values.title?.trim() || getDefaultWidgetTitle(normalizedValues);
    onApply(normalizedValues);
    onClose();
  }

  const isKpiWidget = widgetKind.startsWith('kpi');

  const chartTypes = [
    { id: 'line', label: 'Line', icon: TrendingUp },
    { id: 'bar', label: 'Bar', icon: BarChart3 },
    { id: 'pie', label: 'Pie', icon: PieChart },
    { id: 'table', label: 'Table', icon: Table },
    { id: 'heatmap', label: 'Heatmap', icon: Grid },
  ] as const;

  const allowedChartTypes = isKpiWidget ? [] : chartTypes.map((type) => type.id);

  const kpiInfoOptionsByWidget: Record<WidgetKind, Array<{ name: 'info1' | 'info2' | 'info3'; label: string; checked: boolean }>> = {
    'kpi-count': [
      { name: 'info1', label: 'Show total alarm note', checked: info1 },
    ],
    'kpi-total': [
      { name: 'info1', label: 'Show total alarm note', checked: info1 },
    ],
    'kpi-active': [
      { name: 'info1', label: 'Show active alarm note', checked: info1 },
    ],
    'kpi-closed': [
      { name: 'info1', label: 'Show closed alarm note', checked: info1 },
    ],
    'kpi-devices': [
      { name: 'info1', label: 'Show unique-device note', checked: info1 },
    ],
    'kpi-status': [
      { name: 'info1', label: 'Show critical alarm count', checked: info1 },
    ],
    'kpi-critical': [
      { name: 'info1', label: 'Show critical alarm count', checked: info1 },
    ],
    'chart-trend': [],
    'chart-severity': [],
    'chart-weekly': [],
    'chart-heatmap': [],
    'chart-extra': [],
    'table-alarms': [],
  };

  const displayOptionsByChart: Record<WidgetSettingsValues['chartType'], Array<{ name: 'info1' | 'info2' | 'info3'; label: string; checked: boolean }>> = {
    line: [
      { name: 'info1', label: 'Show grid', checked: info1 },
      { name: 'info3', label: 'Show hover tooltip', checked: info3 },
    ],
    bar: [
      { name: 'info1', label: 'Show grid', checked: info1 },
      { name: 'info3', label: 'Show hover tooltip', checked: info3 },
    ],
    pie: [
      { name: 'info1', label: 'Show hover tooltip', checked: info1 },
      { name: 'info2', label: 'Show legend', checked: info2 },
    ],
    heatmap: [
      { name: 'info1', label: 'Show hover tooltip', checked: info1 },
      { name: 'info2', label: 'Show time / date labels', checked: info2 },
    ],
    table: [
      { name: 'info1', label: 'Time column', checked: info1 },
      { name: 'info2', label: 'Error code column', checked: info2 },
      { name: 'info3', label: 'Status column', checked: info3 },
    ],
  };

  const infoOptions = isKpiWidget ? kpiInfoOptionsByWidget[widgetKind] : displayOptionsByChart[selectedChartType];
  const canGroup = selectedChartType === 'pie' || selectedChartType === 'bar';
  const canUseTimeBucket = selectedChartType === 'line' || (selectedChartType === 'bar' && selectedGroupBy === 'none');
  const canUseMetric = selectedChartType === 'line' || selectedChartType === 'bar' || selectedChartType === 'pie';
  const dateRangeLabel = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  const heatmapModeLabel = selectedHeatmapMode === 'calendar' ? 'Year heatmap' : 'Weekday heatmap';
  const selectedYear = getYearFromDate(startDate);

  function selectChartType(type: WidgetSettingsValues['chartType']) {
    setValue('chartType', type);
    if (type === 'line' || type === 'table' || type === 'heatmap') {
      setValue('groupBy', 'none');
    }
    if (type === 'pie' && selectedGroupBy === 'none') {
      setValue('groupBy', 'severity');
    }
    if (type === 'heatmap' && !selectedHeatmapMode) {
      setValue('heatmapMode', 'weekday');
    }
  }

  function selectHeatmapMode(mode: HeatmapMode) {
    setValue('heatmapMode', mode);
    if (mode === 'calendar') {
      const range = getYearDateRange(getYearFromDate(startDate));
      setValue('startDate', range.startDate);
      setValue('endDate', range.endDate);
    }
  }

  function selectCalendarYear(year: string) {
    const range = getYearDateRange(year);
    setValue('startDate', range.startDate);
    setValue('endDate', range.endDate);
  }

  function toggleTableColumn(column: ExportColumn) {
    setValue(
      'tableColumns',
      tableColumns.includes(column)
        ? tableColumns.filter((item) => item !== column)
        : [...tableColumns, column],
    );
  }

  function applyPreset(presetId: string) {
    const preset = presets.find((option) => option.id === presetId);
    if (!preset) {
      setValue('preset', presetId);
      return;
    }
    const currentValues = getValues();
    reset({
      ...currentValues,
      ...preset.values,
      preset: preset.id,
      startDate: currentValues.startDate,
      endDate: currentValues.endDate,
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-panel-light text-light shadow-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <div className="relative overflow-hidden border-b border-primary/30 px-6 py-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
          <div>
            <h2 className="mt-1 text-3xl font-black text-light drop-shadow-glow-primary">
              Preset Settings
            </h2>
            <div className="mt-3 flex items-center gap-1 border border-secondary/25 bg-secondary/5 px-2.5 py-1">
              {editingWidgetName ? (
                <input
                  autoFocus
                  aria-label="Preset name"
                  value={title ?? ''}
                  onChange={(event) => setValue('title', event.target.value)}
                  onBlur={() => setEditingWidgetName(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  placeholder={getDefaultWidgetTitle(watch())}
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs font-black text-secondary outline-none placeholder:text-placeholder"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-black text-secondary">
                  {title?.trim() || widgetTitle || getDefaultWidgetTitle(watch())}
                </span>
              )}
              <button
                type="button"
                aria-label="Rename preset"
                title="Rename preset"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setEditingWidgetName(true)}
                className={drawerIconButtonClass}
              >
                <PenLine size={13} />
              </button>
            </div>
          </div>
          <div className="absolute right-6 top-5 flex items-center gap-3">
            {!isKpiWidget && (
              <button
                type="button"
                aria-label={layoutSpan === 2 ? 'Use half width' : 'Use full width'}
                title={layoutSpan === 2 ? 'Full width. Click for half width.' : 'Half width. Click for full width.'}
                onClick={() => setValue('layoutSpan', layoutSpan === 2 ? 1 : 2)}
                className={layoutSpan === 2 ? drawerIconButtonClass : drawerMutedIconButtonClass}
              >
                {layoutSpan === 2 ? (
                  <Minimize2 size={18} />
                ) : (
                  <Maximize2 size={18} />
                )}
              </button>
            )}
            {isKpiWidget ? (
              <button
                type="button"
                aria-checked={visible}
                aria-label={visible ? 'Hide KPI card' : 'Show KPI card'}
                title={visible ? 'Hide KPI card' : 'Show KPI card'}
                onClick={() => setValue('visible', !visible)}
                className={visible ? drawerIconButtonClass : drawerDangerIconButtonClass}
              >
                {visible ? (
                  <Eye size={18} />
                ) : (
                  <EyeOff size={18} />
                )}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close widget settings"
              title="Close widget settings"
              onClick={onClose}
              className="rounded p-1.5 text-primary transition hover:bg-primary/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-5">
            {!isKpiWidget ? (
              <Field label="Start from preset" hint="Selecting one fills every option; saving updates the preset name and configuration for this widget.">
                <Select value={selectedPresetValue} onChange={(event) => applyPreset(event.target.value)}>
                  <option value="">Current widget settings</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {!isKpiWidget ? (
              <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold tracking-normal text-secondary">
                  Display
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {chartTypes
                    .filter((type) => allowedChartTypes.includes(type.id))
                    .map((type) => {
                    const Icon = type.icon;
                    const isSelected = selectedChartType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => selectChartType(type.id)}
                        className={`flex min-h-[86px] flex-col items-center justify-center border p-3 transition ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-glow-primary'
                            : 'border-border bg-panel-light text-muted hover:border-primary/60 hover:text-light'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="mt-2 font-mono text-sm font-bold tracking-normal">
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!isKpiWidget && canUseMetric ? (
              <>
                <Field label="Data">
                  <Select {...register('metric')}>
                    <option value="count">Alarm count</option>
                    <option value="avg_duration">Avg handling time</option>
                    <option value="max_duration">Max handling time</option>
                    <option value="affected_devices">Affected devices</option>
                  </Select>
                </Field>

                {canGroup ? (
                  <Field label={selectedChartType === 'pie' ? 'Slice by' : 'Group by'}>
                    <Select {...register('groupBy')}>
                      {selectedChartType === 'bar' ? <option value="none">No group (time series)</option> : null}
                      <option value="severity">Severity</option>
                      <option value="status">Status</option>
                      <option value="error_code">Error code</option>
                      <option value="device">Device</option>
                      <option value="device_type">Device type</option>
                      <option value="vendor">Vendor</option>
                      <option value="station">Station</option>
                      <option value="province">Province</option>
                    </Select>
                  </Field>
                ) : null}

                {canUseTimeBucket ? (
                  <Field label="Time bucket">
                    <Select {...register('timeBucket')}>
                      <option value="hour">Hourly</option>
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </Select>
                  </Field>
                ) : null}
              </>
            ) : null}

            {!isKpiWidget && selectedChartType === 'heatmap' ? (
              <div className="flex flex-col gap-3">
                <Field label="Heatmap mode">
                  <Select value={selectedHeatmapMode} onChange={(event) => selectHeatmapMode(event.target.value as HeatmapMode)}>
                    <option value="weekday">Weekday heatmap</option>
                    <option value="calendar">Year heatmap</option>
                  </Select>
                </Field>
                <p className="font-mono text-xs text-muted">
                  {heatmapModeLabel} uses the matching aggregation view.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <span className="font-mono text-base font-black tracking-normal text-medium">
                {!isKpiWidget && selectedChartType === 'table' ? 'Table columns' : isKpiWidget ? 'Display details' : 'Display options'}
              </span>
              {!isKpiWidget && selectedChartType === 'table' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setValue('tableColumns', defaultTableColumns)}>
                      Default
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setValue('tableColumns', [])}>
                      Deselect all
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setValue('tableColumns', tableColumnOptions.map((item) => item.value))}
                    >
                      Select all
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tableColumnOptions.map((item) => {
                      const checked = tableColumns.includes(item.value);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => toggleTableColumn(item.value)}
                          className={`flex items-center justify-between border p-3 text-left transition ${
                            checked
                              ? 'border-secondary/40 bg-secondary/5 text-light'
                              : 'border-border bg-panel-light text-muted'
                          }`}
                        >
                          <span className="font-mono text-sm">{item.label}</span>
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded transition ${
                              checked ? 'bg-secondary text-input-dark' : 'border border-white/20 bg-transparent'
                            }`}
                          >
                            {checked && <Check size={14} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {infoOptions.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setValue(item.name, !item.checked)}
                      className={`flex items-center justify-between border p-3 transition ${
                        item.checked
                          ? 'border-secondary/40 bg-secondary/5 text-light'
                          : 'border-border bg-panel-light text-muted'
                      }`}
                    >
                      <span className="text-sm font-mono">{item.label}</span>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded transition ${
                          item.checked
                            ? 'bg-secondary text-input-dark'
                            : 'border border-white/20 bg-transparent'
                        }`}
                      >
                        {item.checked && <Check size={14} strokeWidth={3} />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {selectedChartType === 'heatmap' && selectedHeatmapMode === 'calendar' ? (
                <>
                  <span className="font-mono text-base font-black tracking-normal text-medium">
                    Year
                  </span>
                  <p className="border border-border bg-panel-light px-3 py-2 font-mono text-xs text-light">
                    {selectedYear === String(new Date().getFullYear())
                      ? `${selectedYear} · Jan 1 to today`
                      : `${selectedYear} · Jan 1 to Dec 31`}
                  </p>
                  <div>
                    <Field label="Year" labelVariant="nested">
                      <Input
                        type="number"
                        min="2020"
                        max={String(new Date().getFullYear())}
                        value={selectedYear}
                        onChange={(event) => selectCalendarYear(event.target.value)}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-mono text-base font-black tracking-normal text-medium">
                    Time range
                  </span>
                  <div className="space-y-3">
                    <Field label="Start date" labelVariant="nested">
                      <Input
                        type="date"
                        value={startDate || initialValues.startDate}
                        onChange={(event) => setValue('startDate', event.target.value)}
                      />
                    </Field>
                    <Field label="End date" labelVariant="nested">
                      <Input
                        type="date"
                        value={endDate || initialValues.endDate}
                        onChange={(event) => setValue('endDate', event.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-5">
          <Button
            type="submit"
            className="h-14 w-full rounded-full border-none bg-gradient-to-r from-primary to-primary-darker text-white shadow-glow-primary"
          >
            Save settings
          </Button>
        </div>
        </form>
      </aside>
    </>
  );
}
