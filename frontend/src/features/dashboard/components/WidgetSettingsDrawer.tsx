import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, TrendingUp, BarChart3, PieChart, Table, Grid, Check, Eye, EyeOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { GroupBy, Metric, TimeBucket } from '../../../services/generated/nettrace-api';

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
    const normalizedValues = {
      ...values,
      startDate: values.startDate || initialValues.startDate || '2026-06-01',
      endDate: values.endDate || initialValues.endDate || '2026-06-30',
      metric: values.metric ?? initialValues.metric,
      timeBucket: values.timeBucket ?? initialValues.timeBucket,
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
    { id: 'line', label: 'ĐƯỜNG', icon: TrendingUp },
    { id: 'bar', label: 'CỘT', icon: BarChart3 },
    { id: 'pie', label: 'TRÒN', icon: PieChart },
    { id: 'table', label: 'BẢNG', icon: Table },
    { id: 'heatmap', label: 'BẢN ĐỒ NHIỆT', icon: Grid },
  ] as const;

  const chartTypesByWidget: Record<WidgetKind, Array<WidgetSettingsValues['chartType']>> = {
    'kpi-count': [],
    'kpi-devices': [],
    'kpi-status': [],
    'chart-trend': ['line', 'bar'],
    'chart-severity': ['pie', 'bar'],
    'chart-weekly': ['bar', 'line'],
    'chart-heatmap': ['heatmap'],
    'chart-extra': ['bar', 'line', 'pie', 'heatmap', 'table'],
    'table-alarms': ['table'],
  };

  const allowedChartTypes = chartTypesByWidget[widgetKind];

  const infoOptionsByWidget: Record<WidgetKind, Array<{ name: 'info1' | 'info2' | 'info3'; label: string; checked: boolean }>> = {
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
    'chart-trend': [
      { name: 'info1', label: 'Hiển thị lưới nền', checked: info1 },
      { name: 'info2', label: 'Hiển thị trục giá trị', checked: info2 },
      { name: 'info3', label: 'Hiển thị tooltip khi hover', checked: info3 },
    ],
    'chart-severity': [
      { name: 'info1', label: 'Hiển thị tooltip khi hover', checked: info1 },
      { name: 'info2', label: 'Hiển thị nhãn nhóm', checked: info2 },
    ],
    'chart-weekly': [
      { name: 'info1', label: 'Hiển thị lưới nền', checked: info1 },
      { name: 'info2', label: 'Hiển thị trục giá trị', checked: info2 },
      { name: 'info3', label: 'Hiển thị tooltip khi hover', checked: info3 },
    ],
    'chart-heatmap': [
      { name: 'info1', label: 'Hiển thị tooltip khi hover', checked: info1 },
      { name: 'info2', label: 'Hiển thị nhãn thời gian / ngày', checked: info2 },
    ],
    'chart-extra': [
      { name: 'info1', label: 'Hiển thị lưới hoặc tooltip', checked: info1 },
      { name: 'info2', label: 'Hiển thị trục hoặc nhãn nhóm', checked: info2 },
      { name: 'info3', label: 'Hiển thị tooltip khi hover', checked: info3 },
    ],
    'table-alarms': [
      { name: 'info1', label: 'Cột thời gian', checked: info1 },
      { name: 'info2', label: 'Cột mã lỗi', checked: info2 },
      { name: 'info3', label: 'Cột trạng thái', checked: info3 },
    ],
  };

  const infoOptions = infoOptionsByWidget[widgetKind];
  const canGroup = selectedChartType === 'pie' || selectedChartType === 'bar';
  const canUseTimeBucket = selectedChartType === 'line' || (selectedChartType === 'bar' && selectedGroupBy === 'none');
  const dateRangeLabel = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-[#f3edff] drop-shadow-[0_0_10px_rgba(255,45,133,0.55)]">
              Chi tiết widget
            </h2>
            <p className="mt-1 font-mono text-xs text-[#a69db6]">{widgetTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-[#ff2d85] transition hover:bg-[#ff2d85]/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="relative border border-[#2b2740] bg-[#191727] p-4">
              <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
              <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
              <span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
              <span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
              <Field label="Tiện ích đang chỉnh">
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

            <button
              type="button"
              onClick={() => setValue('visible', !visible)}
              className={`relative flex items-center justify-between border p-4 text-left transition ${
                visible
                  ? 'border-[#00f5d4]/50 bg-[#00f5d4]/5 text-[#f3edff]'
                  : 'border-[#ff2d85]/60 bg-[#ff2d85]/10 text-[#f3edff]'
              }`}
            >
              <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
              <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
              <span className="flex items-center gap-2 font-mono text-sm">
                {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                {visible ? 'Đang hiển thị trên dashboard' : 'Đang ẩn khỏi dashboard'}
              </span>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded transition ${
                  visible ? 'bg-[#00f5d4] text-[#0c0b14]' : 'border border-white/20 bg-transparent'
                }`}
              >
                {visible && <Check size={14} strokeWidth={3} />}
              </div>
            </button>

            {!isKpiWidget ? (
              <div className="relative border border-[#2b2740] bg-[#191727] p-4">
                <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
                <span className="absolute -right-px -bottom-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#00f5d4]">
                  Loại biểu đồ
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
                        onClick={() => setValue('chartType', type.id)}
                        className={`flex min-h-[86px] flex-col items-center justify-center border p-3 transition ${
                          isSelected
                            ? 'border-[#ff2d85] bg-[#ff2d85]/10 text-[#ff2d85] shadow-[0_0_18px_rgba(255,45,133,0.24)]'
                            : 'border-[#2b2740] bg-[#151421] text-[#a69db6] hover:border-[#ff2d85]/60 hover:text-[#f3edff]'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="mt-2 font-mono text-[10px] font-bold tracking-normal">
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!isKpiWidget && ['line', 'bar', 'pie'].includes(selectedChartType) ? (
              <div className="relative space-y-4 border border-[#2b2740] bg-[#191727] p-4">
                <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
                <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
                <Field label="Kịch bản thông tin từ API">
                  <Select {...register('metric')}>
                    <option value="count">Số lượng cảnh báo (Count)</option>
                    <option value="avg_duration">Thời gian xử lý trung bình (Avg Duration)</option>
                    <option value="max_duration">Thời gian xử lý tối đa (Max Duration)</option>
                    <option value="affected_devices">Số thiết bị ảnh hưởng (Affected Devices)</option>
                  </Select>
                </Field>

                <Field label="Phân nhóm dữ liệu">
                  <Select {...register('groupBy')} disabled={!canGroup}>
                    <option value="none">Không phân nhóm (Over Time)</option>
                    <option value="severity">Theo mức độ nghiêm trọng (Severity)</option>
                    <option value="status">Theo trạng thái (Status)</option>
                    <option value="error_code">Theo mã lỗi (Error Code)</option>
                    <option value="device">Theo thiết bị (Device)</option>
                    <option value="device_type">Theo loại thiết bị (Device Type)</option>
                    <option value="vendor">Theo nhà cung cấp (Vendor)</option>
                    <option value="station">Theo trạm (Station)</option>
                    <option value="province">Theo tỉnh thành (Province)</option>
                  </Select>
                </Field>

                <Field label="Độ chia thời gian">
                  <Select {...register('timeBucket')} disabled={!canUseTimeBucket}>
                    <option value="hour">Theo giờ</option>
                    <option value="day">Theo ngày</option>
                    <option value="week">Theo tuần</option>
                    <option value="month">Theo tháng</option>
                    <option value="year">Theo năm</option>
                  </Select>
                </Field>
              </div>
            ) : null}

            <div className="relative border border-[#2b2740] bg-[#191727] p-4">
              <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
              <span className="absolute -right-px -bottom-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[#00f5d4]">
                {isKpiWidget ? 'Thông tin hiển thị' : 'Thông tin phù hợp'}
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
              <span className="text-xs font-semibold uppercase tracking-wide text-[#00f5d4]">
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
            </div>

            <div>
              <Button
                type="submit"
                className="h-14 w-full rounded-full border-none bg-gradient-to-r from-[#ff2d85] to-[#9f0645] text-white shadow-[0_0_28px_rgba(255,45,133,0.46)]"
              >
                Lưu chi tiết widget
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
