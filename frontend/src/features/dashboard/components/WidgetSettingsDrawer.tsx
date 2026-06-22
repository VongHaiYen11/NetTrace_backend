import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, TrendingUp, BarChart3, PieChart, Table, Grid, Check, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { GroupBy, Metric, TimeBucket } from '../../../services/generated/nettrace-api';

type HeatmapMode = 'weekday' | 'calendar';

const drawerIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-[#00f5d4] transition hover:text-[#9ef7ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f5d4]/30';

const drawerMutedIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-[#a69db6] transition hover:text-[#f3edff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f5d4]/30';

const drawerDangerIconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent text-[#ff5a9d] transition hover:text-[#ff8fbd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2d85]/30';

export type WidgetKind =
  | 'kpi-count'
  | 'kpi-devices'
  | 'kpi-status'
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
  preset: string;
  startDate: string;
  endDate: string;
  layoutSpan?: 1 | 2;
}

interface WidgetSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (values: WidgetSettingsValues) => void;
  initialValues: WidgetSettingsValues;
  widgetTitle: string;
  widgetKind: WidgetKind;
  availableWidgets: Array<{ id: string; title: string; visible: boolean }>;
  activeWidgetId: string;
  onWidgetChange: (widgetId: string) => void;
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
  availableWidgets,
  activeWidgetId,
  onWidgetChange,
}: WidgetSettingsDrawerProps) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<WidgetSettingsValues>({
    defaultValues: initialValues,
    shouldUnregister: false,
  });

  const visible = watch('visible');
  const selectedChartType = watch('chartType');
  const selectedGroupBy = watch('groupBy');
  const selectedHeatmapMode = watch('heatmapMode');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const info1 = watch('info1');
  const info2 = watch('info2');
  const info3 = watch('info3');
  const layoutSpan = watch('layoutSpan') || 1;

  // Reset form when active widget changes or drawer opens
  useEffect(() => {
    reset(initialValues);
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
      { name: 'info1', label: 'Show open / closed status', checked: info1 },
      { name: 'info2', label: 'Show icon', checked: info2 },
    ],
    'kpi-devices': [
      { name: 'info1', label: 'Show unique-device note', checked: info1 },
      { name: 'info2', label: 'Show icon', checked: info2 },
    ],
    'kpi-status': [
      { name: 'info1', label: 'Show critical alarm count', checked: info1 },
      { name: 'info2', label: 'Show icon', checked: info2 },
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
      { name: 'info2', label: 'Show value axis', checked: info2 },
      { name: 'info3', label: 'Show hover tooltip', checked: info3 },
    ],
    bar: [
      { name: 'info1', label: 'Show grid', checked: info1 },
      { name: 'info2', label: 'Show value axis', checked: info2 },
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

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <div>
            <h2 className="text-2xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.7)]">
              Widget settings
            </h2>
            <p className="mt-1 font-mono text-sm font-bold text-[#a69db6]">{widgetTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isKpiWidget && (
              <button
                type="button"
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
            <button
              type="button"
              aria-checked={visible}
              title={visible ? 'Visible on dashboard' : 'Hidden from dashboard'}
              onClick={() => setValue('visible', !visible)}
              className={visible ? drawerIconButtonClass : drawerDangerIconButtonClass}
            >
              {visible ? (
                <Eye size={18} />
              ) : (
                <EyeOff size={18} />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-[#ff2d85] transition hover:bg-[#ff2d85]/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <Field label="Widget">
              <Select
                value={activeWidgetId}
                onChange={(event) => onWidgetChange(event.target.value)}
              >
                {availableWidgets.map((widget) => (
                  <option key={widget.id} value={widget.id}>
                    {widget.title}{widget.visible ? '' : ' - hidden'}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Widget name" hint="Leave blank to use data + time range.">
              <Input placeholder={getDefaultWidgetTitle(watch())} {...register('title')} />
            </Field>

            {!isKpiWidget ? (
              <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
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
                            ? 'border-[#ff2d85] bg-[#ff2d85]/10 text-[#ff2d85] shadow-[0_0_18px_rgba(255,45,133,0.24)]'
                            : 'border-[#2b2740] bg-[#151421] text-[#a69db6] hover:border-[#ff2d85]/60 hover:text-[#f3edff]'
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
                <p className="font-mono text-xs text-[#a69db6]">
                  {heatmapModeLabel} uses the matching aggregation view.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                {isKpiWidget ? 'Display details' : 'Display options'}
              </span>
              <div className="flex flex-col gap-2.5">
                {infoOptions.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setValue(item.name, !item.checked)}
                    className={`flex items-center justify-between border p-3 transition ${
                      item.checked
                        ? 'border-[#00f5d4]/40 bg-[#00f5d4]/5 text-[#f3edff]'
                        : 'border-[#2b2740] bg-[#151421] text-[#a69db6]'
                    }`}
                  >
                    <span className="text-sm font-mono">{item.label}</span>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded transition ${
                        item.checked
                          ? 'bg-[#00f5d4] text-[#0c0b14]'
                          : 'border border-white/20 bg-transparent'
                      }`}
                    >
                      {item.checked && <Check size={14} strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {selectedChartType === 'heatmap' && selectedHeatmapMode === 'calendar' ? (
                <>
                  <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                    Year
                  </span>
                  <p className="border border-[#2b2740] bg-[#151421] px-3 py-2 font-mono text-xs text-[#f3edff]">
                    {selectedYear === String(new Date().getFullYear())
                      ? `${selectedYear} · Jan 1 to today`
                      : `${selectedYear} · Jan 1 to Dec 31`}
                  </p>
                  <div>
                    <Field label="Year">
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
                  <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                    Time range
                  </span>
                  <p className="border border-[#2b2740] bg-[#151421] px-3 py-2 font-mono text-xs text-[#f3edff]">
                    {dateRangeLabel}
                  </p>
                  <div className="space-y-3">
                    <Field label="Start date">
                      <Input
                        type="date"
                        value={startDate || initialValues.startDate}
                        onChange={(event) => setValue('startDate', event.target.value)}
                      />
                    </Field>
                    <Field label="End date">
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

            <div>
              <Button
                type="submit"
                className="h-14 w-full rounded-full border-none bg-gradient-to-r from-[#ff2d85] to-[#9f0645] text-white shadow-[0_0_28px_rgba(255,45,133,0.46)]"
              >
                Save settings
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
