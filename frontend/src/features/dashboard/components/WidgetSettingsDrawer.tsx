import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, TrendingUp, BarChart3, PieChart, Table, Grid, Check, Eye, EyeOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { GroupBy, Metric, TimeBucket } from '../../../services/generated/nettrace-api';

type HeatmapMode = 'weekday' | 'calendar';

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
  if (!value) return 'Chưa chọn';
  try {
    return format(parseISO(value), 'dd/MM/yyyy');
  } catch {
    return value;
  }
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
    onApply(normalizedValues);
    onClose();
  }

  const isKpiWidget = widgetKind.startsWith('kpi');

  const chartTypes = [
    { id: 'line', label: 'Đường', icon: TrendingUp },
    { id: 'bar', label: 'Cột', icon: BarChart3 },
    { id: 'pie', label: 'Tròn', icon: PieChart },
    { id: 'table', label: 'Bảng', icon: Table },
    { id: 'heatmap', label: 'Bản đồ nhiệt', icon: Grid },
  ] as const;

  const allowedChartTypes = isKpiWidget ? [] : chartTypes.map((type) => type.id);

  const kpiInfoOptionsByWidget: Record<WidgetKind, Array<{ name: 'info1' | 'info2' | 'info3'; label: string; checked: boolean }>> = {
    'kpi-count': [
      { name: 'info1', label: 'Hiển thị trạng thái mở / đóng', checked: info1 },
      { name: 'info2', label: 'Hiển thị biểu tượng', checked: info2 },
    ],
    'kpi-devices': [
      { name: 'info1', label: 'Hiển thị mô tả thiết bị duy nhất', checked: info1 },
      { name: 'info2', label: 'Hiển thị biểu tượng', checked: info2 },
    ],
    'kpi-status': [
      { name: 'info1', label: 'Hiển thị số cảnh báo nghiêm trọng', checked: info1 },
      { name: 'info2', label: 'Hiển thị biểu tượng', checked: info2 },
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
      { name: 'info1', label: 'Hiển thị lưới nền', checked: info1 },
      { name: 'info2', label: 'Hiển thị trục giá trị', checked: info2 },
      { name: 'info3', label: 'Hiển thị tooltip khi hover', checked: info3 },
    ],
    bar: [
      { name: 'info1', label: 'Hiển thị lưới nền', checked: info1 },
      { name: 'info2', label: 'Hiển thị trục giá trị', checked: info2 },
      { name: 'info3', label: 'Hiển thị tooltip khi hover', checked: info3 },
    ],
    pie: [
      { name: 'info1', label: 'Hiển thị tooltip khi hover', checked: info1 },
      { name: 'info2', label: 'Hiển thị nhãn nhóm', checked: info2 },
    ],
    heatmap: [
      { name: 'info1', label: 'Hiển thị tooltip khi hover', checked: info1 },
      { name: 'info2', label: 'Hiển thị nhãn thời gian / ngày', checked: info2 },
    ],
    table: [
      { name: 'info1', label: 'Cột thời gian', checked: info1 },
      { name: 'info2', label: 'Cột mã lỗi', checked: info2 },
      { name: 'info3', label: 'Cột trạng thái', checked: info3 },
    ],
  };

  const infoOptions = isKpiWidget ? kpiInfoOptionsByWidget[widgetKind] : displayOptionsByChart[selectedChartType];
  const canGroup = selectedChartType === 'pie' || selectedChartType === 'bar';
  const canUseTimeBucket = selectedChartType === 'line' || (selectedChartType === 'bar' && selectedGroupBy === 'none');
  const canUseMetric = selectedChartType === 'line' || selectedChartType === 'bar' || selectedChartType === 'pie';
  const dateRangeLabel = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  const heatmapModeLabel = selectedHeatmapMode === 'calendar' ? 'Bản đồ theo năm' : 'Bản đồ theo tuần';
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

      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <div>
            <h2 className="text-2xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.7)]">
              Cấu hình widget
            </h2>
            <p className="mt-1 font-mono text-sm font-bold text-[#a69db6]">{widgetTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-checked={visible}
              title={visible ? 'Đang hiển thị trên dashboard' : 'Đang ẩn khỏi dashboard'}
              onClick={() => setValue('visible', !visible)}
              className={`flex h-10 w-10 items-center justify-center rounded border transition ${
                visible
                  ? 'border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] shadow-[0_0_16px_rgba(0,245,212,0.25)]'
                  : 'border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85] shadow-[0_0_16px_rgba(255,45,133,0.25)]'
              }`}
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
            <div className="relative border border-[#2b2740] bg-[#191727] p-4">
              <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
              <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
              <span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
              <span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
              <Field label="Widget đang chỉnh">
                <Select
                  value={activeWidgetId}
                  onChange={(event) => onWidgetChange(event.target.value)}
                >
                  {availableWidgets.map((widget) => (
                    <option key={widget.id} value={widget.id}>
                      {widget.title}{widget.visible ? '' : ' - đang ẩn'}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {!isKpiWidget ? (
              <div className="relative border border-[#2b2740] bg-[#191727] p-4">
                <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
                <span className="absolute -right-px -bottom-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
                <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                  Dạng hiển thị
                </span>
                <div className="mt-3 grid grid-cols-2 gap-3">
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
              <div className="relative space-y-4 border border-[#2b2740] bg-[#191727] p-4">
                <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
                <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
                <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
                <span className="absolute -right-px -bottom-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
                <Field label="Dữ liệu muốn xem">
                  <Select {...register('metric')}>
                    <option value="count">Số lượng cảnh báo</option>
                    <option value="avg_duration">Thời gian xử lý trung bình</option>
                    <option value="max_duration">Thời gian xử lý lâu nhất</option>
                    <option value="affected_devices">Thiết bị bị ảnh hưởng</option>
                  </Select>
                </Field>

                {canGroup ? (
                  <Field label={selectedChartType === 'pie' ? 'Chia lát theo' : 'Nhóm dữ liệu theo'}>
                    <Select {...register('groupBy')}>
                      {selectedChartType === 'bar' ? <option value="none">Không phân nhóm (theo thời gian)</option> : null}
                      <option value="severity">Theo mức độ nghiêm trọng</option>
                      <option value="status">Theo trạng thái</option>
                      <option value="error_code">Theo mã lỗi</option>
                      <option value="device">Theo thiết bị</option>
                      <option value="device_type">Theo loại thiết bị</option>
                      <option value="vendor">Theo nhà cung cấp</option>
                      <option value="station">Theo trạm</option>
                      <option value="province">Theo tỉnh thành</option>
                    </Select>
                  </Field>
                ) : null}

                {canUseTimeBucket ? (
                  <Field label="Mốc thời gian">
                    <Select {...register('timeBucket')}>
                      <option value="hour">Theo giờ</option>
                      <option value="day">Theo ngày</option>
                      <option value="week">Theo tuần</option>
                      <option value="month">Theo tháng</option>
                      <option value="year">Theo năm</option>
                    </Select>
                  </Field>
                ) : null}
              </div>
            ) : null}

            {!isKpiWidget && selectedChartType === 'heatmap' ? (
              <div className="relative space-y-4 border border-[#2b2740] bg-[#191727] p-4">
                <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
                <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
                <Field label="Kiểu bản đồ">
                  <Select value={selectedHeatmapMode} onChange={(event) => selectHeatmapMode(event.target.value as HeatmapMode)}>
                    <option value="weekday">Bản đồ theo tuần</option>
                    <option value="calendar">Bản đồ theo năm</option>
                  </Select>
                </Field>
                <p className="font-mono text-xs text-[#a69db6]">
                  {heatmapModeLabel} sẽ tổng hợp dữ liệu theo cách tương ứng.
                </p>
              </div>
            ) : null}

            <div className="relative border border-[#2b2740] bg-[#191727] p-4">
              <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
              <span className="absolute -right-px -bottom-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
              <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                {isKpiWidget ? 'Chi tiết hiển thị' : 'Tùy chọn hiển thị'}
              </span>
              <div className="mt-3 flex flex-col gap-2.5">
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

            <div className="relative border border-[#2b2740] bg-[#191727] p-4">
              <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
              <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
              {selectedChartType === 'heatmap' && selectedHeatmapMode === 'calendar' ? (
                <>
                  <span className="text-sm font-semibold tracking-normal text-[#00f5d4]">
                    Năm hiển thị
                  </span>
                  <p className="mt-2 border border-[#2b2740] bg-[#151421] px-3 py-2 font-mono text-xs text-[#f3edff]">
                    {selectedYear === String(new Date().getFullYear())
                      ? `${selectedYear} · từ 01/01 đến hôm nay`
                      : `${selectedYear} · từ 01/01 đến 31/12`}
                  </p>
                  <div className="mt-4">
                    <Field label="Chọn năm">
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
                    Khoảng thời gian
                  </span>
                  <p className="mt-2 border border-[#2b2740] bg-[#151421] px-3 py-2 font-mono text-xs text-[#f3edff]">
                    {dateRangeLabel}
                  </p>
                  <div className="mt-4 space-y-3">
                    <Field label="Ngày bắt đầu">
                      <Input type="date" {...register('startDate')} />
                    </Field>
                    <Field label="Ngày kết thúc">
                      <Input type="date" {...register('endDate')} />
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
                Lưu cấu hình
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
