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
  PieChart,
  RadioTower,
  Search,
  Table,
  TrendingUp,
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
    title: 'Tổng cảnh báo',
    fields: ['totalAlarms', 'activeAlarms', 'closedAlarms'],
    description: 'Hiển thị tổng số cảnh báo, cảnh báo đang hoạt động và đã đóng.',
  },
  {
    key: 'kpi-devices',
    icon: TrendingUp,
    title: 'Thiết bị ảnh hưởng',
    fields: ['affectedDevices'],
    description: 'Hiển thị số thiết bị duy nhất đang bị ảnh hưởng.',
  },
  {
    key: 'kpi-status',
    icon: AlertTriangle,
    title: 'Cảnh báo nghiêm trọng',
    fields: ['criticalAlarms'],
    description: 'Hiển thị trạng thái và tổng cảnh báo nghiêm trọng.',
  },
] as const;

const informationScenarios = [
  { value: 'count', label: 'Số lượng cảnh báo' },
  { value: 'avg_duration', label: 'Thời gian xử lý trung bình' },
  { value: 'max_duration', label: 'Thời gian xử lý lâu nhất' },
  { value: 'affected_devices', label: 'Thiết bị bị ảnh hưởng' },
] as const;

const groupScenarios = [
  { value: 'none', label: 'Không phân nhóm' },
  { value: 'severity', label: 'Theo mức độ' },
  { value: 'status', label: 'Theo trạng thái' },
  { value: 'error_code', label: 'Theo mã lỗi' },
  { value: 'device', label: 'Theo thiết bị' },
  { value: 'device_type', label: 'Theo loại thiết bị' },
  { value: 'vendor', label: 'Theo nhà cung cấp' },
  { value: 'station', label: 'Theo trạm' },
  { value: 'province', label: 'Theo tỉnh thành' },
] as const;

const timeBucketOptions = [
  { value: 'hour', label: 'Theo giờ' },
  { value: 'day', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
  { value: 'year', label: 'Theo năm' },
] as const;

const heatmapModeOptions = [
  { value: 'weekday', label: 'Bản đồ theo tuần' },
  { value: 'calendar', label: 'Bản đồ theo năm' },
] as const;

const chartTypeOptions = [
  { value: 'line', label: 'Biểu đồ đường', icon: TrendingUp },
  { value: 'bar', label: 'Biểu đồ cột', icon: BarChart3 },
  { value: 'pie', label: 'Biểu đồ tròn', icon: PieChart },
  { value: 'heatmap', label: 'Bản đồ nhiệt', icon: Grid3X3 },
  { value: 'table', label: 'Bảng dữ liệu', icon: Table },
] as const;

function getDisplayOptions(widget: DashboardWidgetConfig) {
  if (widget.chartType === 'table') {
    return [
      { key: 'info1', label: 'Cột thời gian', checked: widget.info1 },
      { key: 'info2', label: 'Cột mã lỗi', checked: widget.info2 },
      { key: 'info3', label: 'Cột trạng thái', checked: widget.info3 },
    ] as const;
  }
  if (widget.chartType === 'heatmap') {
    return [
      { key: 'info1', label: 'Tooltip khi hover', checked: widget.info1 },
      { key: 'info2', label: 'Nhãn thời gian / ngày', checked: widget.info2 },
    ] as const;
  }
  if (widget.chartType === 'pie') {
    return [
      { key: 'info1', label: 'Tooltip khi hover', checked: widget.info1 },
      { key: 'info2', label: 'Nhãn nhóm', checked: widget.info2 },
    ] as const;
  }
  return [
    { key: 'info1', label: 'Lưới nền', checked: widget.info1 },
    { key: 'info2', label: 'Trục giá trị', checked: widget.info2 },
    { key: 'info3', label: 'Tooltip khi hover', checked: widget.info3 },
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
    name: 'Vận hành mạng',
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
    name: 'Kiểm toán bảo mật',
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
    name: 'Telemetry người dùng',
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
  name: 'Tập trung terminal',
  description: 'CLI / RAW_DATA',
};

function getVisibleChartCount(widgets: DashboardWidgetConfig[]) {
  const count = widgets.filter((widget) => !widget.type.startsWith('kpi') && widget.visible).length;
  if (count <= 2) return 2;
  if (count <= 4) return 4;
  return 6;
}

function getLayoutCountLabel(count: number) {
  return `Giao diện ${count} widget`;
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
  const [dashboardStatusOpen, setDashboardStatusOpen] = useState(true);
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
      setDashboardStatusOpen(true);
      setTemplateDropdownOpen(false);
      setDetailModalOpen(false);
      setDetailStep('template');
      setSelectedSlotId(null);
      setRestoreWidgetId(null);
    }
  }, [isOpen, widgets]);

  const layoutCount = useMemo(() => getLayoutCapacity(detailDraftWidgets), [detailDraftWidgets]);
  const kpiWidgets = detailDraftWidgets.filter((widget) => widget.type.startsWith('kpi'));
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

  function toggleKpi(widgetId: string) {
    setSelectedTemplateId('none');
    setDetailDraftWidgets((current) =>
      current.map((widget) => (widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget)),
    );
  }

  function saveAndClose() {
    onSave(draftWidgets);
    onClose();
  }

  function openDetailModal() {
    setDetailDraftWidgets(draftWidgets);
    setSelectedSlotId(getVisibleChartWidgets(draftWidgets)[0]?.id ?? getChartWidgets(draftWidgets)[0]?.id ?? null);
    setDetailStep('template');
    setDetailModalOpen(true);
  }

  function saveDetailDraft() {
    setDraftWidgets(detailDraftWidgets);
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
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <h2 className="text-2xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.7)]">
            Tùy chỉnh dashboard
          </h2>
          <button className="rounded p-1.5 text-[#ff2d85] hover:bg-[#ff2d85]/10" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <section className="border border-[#00f5d4]/35 bg-[#101923] p-4 shadow-[0_0_18px_rgba(0,245,212,0.08)]">
            <button
              type="button"
              className={cn(
                'flex w-full items-start justify-between gap-3 text-left',
                dashboardStatusOpen && 'border-b border-[#00f5d4]/20 pb-3',
              )}
              onClick={() => setDashboardStatusOpen((value) => !value)}
            >
              <span>
                <span className="block font-mono text-lg font-black text-[#00f5d4] drop-shadow-[0_0_8px_rgba(0,245,212,0.45)]">
                  Trạng thái dashboard
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-[#a69db6]">
                  Kiểm tra layout hiện tại và bật/tắt từng widget đang có.
                </span>
              </span>
              {dashboardStatusOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-[#00f5d4]" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-[#00f5d4]" size={20} />
              )}
            </button>

            {dashboardStatusOpen ? (
              <>
                <div className="mt-4 border border-[#2b2740] bg-[#191727] p-4">
              <p className="font-mono text-base font-black text-[#f3edff]">
                Thông tin hiện tại
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-[#2b2740] bg-[#151421] p-3">
                  <p className="font-mono text-[11px] text-[#a69db6]">Giao diện</p>
                  <p className="mt-1 font-mono text-sm font-black text-[#f3edff]">
                    {getLayoutCountLabel(sidebarLayoutCount)}
                  </p>
                </div>
                <div className="border border-[#2b2740] bg-[#151421] p-3">
                  <p className="font-mono text-[11px] text-[#a69db6]">Đang hiển thị</p>
                  <p className="mt-1 font-mono text-sm font-black text-[#f3edff]">
                    {sidebarVisibleCharts.length}/{getChartWidgets(draftWidgets).length} widget
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-base font-black text-[#f3edff]">Widget đang hiển thị</p>
              <span className="font-mono text-xs text-[#a69db6]">{sidebarVisibleCharts.length}/{getChartWidgets(draftWidgets).length}</span>
            </div>
            <div className="space-y-2">
              {sidebarVisibleCharts.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center justify-between gap-3 border border-[#2b2740] bg-[#191727] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-[#f3edff]">{widget.title}</p>
                    <p className="font-mono text-[11px] text-[#a69db6]">
                      Slot {widget.layoutOrder} · {widget.layoutSpan === 2 ? '2 ô desktop' : '1 ô'}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Ẩn widget"
                    onClick={() => hideSidebarWidget(widget.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#00f5d4]/50 bg-[#00f5d4]/10 text-[#00f5d4] transition hover:bg-[#00f5d4]/15"
                  >
                    <Eye size={17} />
                  </button>
                </div>
              ))}
            </div>
            </div>

            <div className="mt-5 space-y-3">
            <p className="font-mono text-base font-black text-[#f3edff]">Widget đang ẩn</p>
            {sidebarHiddenCharts.length > 0 ? (
              <div className="space-y-2">
                {sidebarHiddenCharts.map((widget) => {
                  const isRestoring = restoreWidgetId === widget.id;
                  return (
                    <div
                      key={widget.id}
                      className={cn(
                        'border bg-[#191727] p-3',
                        isRestoring ? 'border-[#ff2d85]' : 'border-[#2b2740]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-[#f3edff]">{widget.title}</p>
                          <p className="font-mono text-[11px] text-[#a69db6]">
                            {widget.layoutSpan === 2 ? 'Ưu tiên 2 ô desktop' : 'Ưu tiên 1 ô'}
                          </p>
                        </div>
                        <button
                          type="button"
                          title="Mở lại widget"
                          onClick={() => startRestoreSidebarWidget(widget.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#ff2d85]/50 bg-[#ff2d85]/10 text-[#ff2d85] transition hover:bg-[#ff2d85]/15"
                        >
                          <EyeOff size={17} />
                        </button>
                      </div>

                      {isRestoring ? (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <p className="font-mono text-xs font-bold text-[#00f5d4]">Chọn vị trí còn trống</p>
                          <p className="mt-1 font-mono text-[11px] leading-relaxed text-[#a69db6]">
                            Vị trí còn trống là ô chưa có widget trong {getLayoutCountLabel(sidebarLayoutCount).toLowerCase()} hiện tại.
                          </p>
                          <div className="mt-2 grid grid-cols-3 gap-2">
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
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreSidebarWidget(widget.id)}
                            className="mt-2 h-9 w-full border border-[#ff2d85]/50 bg-[#ff2d85]/5 font-mono text-xs font-bold text-[#ff2d85] transition hover:bg-[#ff2d85]/10"
                          >
                            Thêm sau widget cuối
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="border border-[#2b2740] bg-[#191727] px-3 py-3 font-mono text-xs text-[#a69db6]">
                Không có widget nào đang ẩn.
              </p>
            )}
            </div>
              </>
            ) : null}
          </section>

          <section className="border border-[#ff2d85]/35 bg-[#1d1524] p-4 shadow-[0_0_18px_rgba(255,45,133,0.08)]">
            <button
              type="button"
              className={cn(
                'flex w-full items-start justify-between gap-3 text-left',
                templateDropdownOpen && 'border-b border-[#ff2d85]/20 pb-3',
              )}
              onClick={() => setTemplateDropdownOpen((value) => !value)}
            >
              <span>
                <span className="block font-mono text-lg font-black text-[#ff2d85] drop-shadow-[0_0_8px_rgba(255,45,133,0.45)]">
                  Template mẫu
                </span>
                <span className="mt-1 block font-mono text-xs leading-relaxed text-[#a69db6]">
                  {selectedTemplate
                    ? `${selectedTemplate.name} · ${getLayoutCountLabel(selectedTemplate.layoutCount)}`
                    : 'Áp dụng nhanh bố cục 2/4/6 widget theo mẫu có sẵn.'}
                </span>
              </span>
              {templateDropdownOpen ? (
                <ChevronDown className="mt-1 shrink-0 text-[#ff2d85]" size={20} />
              ) : (
                <ChevronRight className="mt-1 shrink-0 text-[#ff2d85]" size={20} />
              )}
            </button>

            {templateDropdownOpen ? (
              <div className="mt-3 space-y-4">
                <label className="flex h-11 items-center gap-2 rounded border border-[#ff2d85]/40 bg-[#211b2d] px-3 shadow-[0_0_20px_rgba(255,45,133,0.12)]">
                  <Search size={20} className="text-[#ff2d85]" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Tìm template"
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
                          'relative w-full border bg-[#191727] p-3 text-left transition',
                          selected
                            ? 'border-[#ff2d85] shadow-[0_0_24px_rgba(255,45,133,0.32)]'
                            : 'border-[#2b2740] hover:border-[#ff2d85]/60',
                        )}
                      >
                        <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
                        <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
                        <span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
                        <span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
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

                  <div className="relative border border-[#2b2740] bg-[#191727] p-3">
                    <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
                    <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
                    <div className="h-20 border border-[#2b2740] bg-[#151421]" />
                    <p className="mt-4 font-mono text-base font-black">Tập trung terminal</p>
                    <p className="mt-1 font-mono text-xs tracking-normal text-[#a69db6]">
                      {extraTemplate.description}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <button
            type="button"
            className="h-12 w-full border border-[#ff2d85] bg-transparent font-mono text-sm font-bold text-[#ff2d85] transition hover:bg-[#ff2d85]/10"
          >
            + Thêm
          </button>

          <Button
            variant="secondary"
            className="h-12 w-full border-[#00f5d4] text-[#00f5d4] hover:bg-[#00f5d4]/10"
            onClick={openDetailModal}
          >
            Tùy chỉnh chi tiết
          </Button>
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <Button
            className="h-14 w-full rounded-full border-none bg-gradient-to-r from-[#ff2d85] to-[#9f0645] text-white shadow-[0_0_28px_rgba(255,45,133,0.46)]"
            onClick={saveAndClose}
          >
            Lưu
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
                  Chỉnh sửa template
                </h2>
                <p className="mt-1 font-mono text-xs text-[#a69db6]">
                  {detailStep === 'template'
                    ? 'Chọn layout và KPI card trước khi chỉnh từng widget.'
                    : 'Chọn vị trí widget trên layout map rồi cấu hình tham số gọi API.'}
                </p>
              </div>
              <button className="rounded p-1.5 text-[#a69db6] hover:bg-white/10 hover:text-white" onClick={closeDetailModal}>
                <X size={20} />
              </button>
            </div>

            {detailStep === 'template' ? (
              <div className="space-y-7 px-6 py-6">
                <Field label="Tên template">
                  <Input value="Template hiện tại" readOnly />
                </Field>

                <div>
                  <p className="font-mono text-lg font-black text-[#f3edff]">Dạng layout</p>
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
                      Chọn KPI Card
                    </p>
                    <span className="font-mono text-[11px] text-[#777086]">
                      Field từ API Summary
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {kpiWidgets.map((widget) => {
                      const option = summaryOptions.find((item) => item.key === widget.type);
                      const Icon = option?.icon ?? Activity;
                      return (
                        <div key={widget.id} className="rounded border border-white/10 bg-[#151421] p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <button
                              type="button"
                              onClick={() => toggleKpi(widget.id)}
                              className="flex items-start gap-3 text-left"
                            >
                              <span
                                className={cn(
                                  'mt-1 flex h-5 w-5 items-center justify-center rounded border',
                                  widget.visible
                                    ? 'border-[#00f5d4] bg-[#00f5d4] text-[#0c0b14]'
                                    : 'border-white/20',
                                )}
                              >
                                {widget.visible ? <Check size={13} strokeWidth={3} /> : null}
                              </span>
                              <span>
                                <span className="flex items-center gap-2 font-bold">
                                  <Icon size={16} className="text-[#ff2d85]" />
                                  {option?.title ?? widget.title}
                                </span>
                                <span className="mt-1 block text-sm text-[#a69db6]">{option?.description}</span>
                                <span className="mt-2 block font-mono text-[11px] text-[#777086]">
                                  Field: {option?.fields.join(', ')}
                                </span>
                              </span>
                            </button>
                            <div className="flex gap-2">
                              <Button size="sm" variant={widget.info1 ? 'primary' : 'ghost'} onClick={() => setDetailDraftWidgets((current) => updateWidget(current, widget.id, { info1: !widget.info1 }))}>
                                Chi tiết
                              </Button>
                              <Button size="sm" variant={widget.info2 ? 'primary' : 'ghost'} onClick={() => setDetailDraftWidgets((current) => updateWidget(current, widget.id, { info2: !widget.info2 }))}>
                                Icon
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-5">
                  <Button variant="ghost" className="h-11 px-5" onClick={closeDetailModal}>Hủy</Button>
                  <Button variant="secondary" className="h-11 px-6 border-[#00f5d4] text-[#00f5d4]" onClick={goToWidgetStep}>
                    Chỉnh widget
                  </Button>
                  <Button className="h-11 px-6" onClick={saveDetailDraft}>Lưu thay đổi</Button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                <h3 className="text-5xl font-black text-[#f3edff] drop-shadow-[0_0_14px_rgba(255,45,133,0.45)]">Chỉnh widget</h3>
                <div className="mt-8 grid gap-7 lg:grid-cols-[260px_1fr]">
                  <div>
                    <p className="font-mono text-lg font-black text-[#00f5d4] drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]">
                      Bản đồ layout
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
                              {widget.layoutSpan === 2 ? <span className="mt-1 font-mono text-[10px] text-[#00f5d4]">2 ô desktop</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-sm italic text-[#a69db6]">
                      Ô có dấu + là vị trí còn trống trong {getLayoutCountLabel(layoutCount).toLowerCase()}.
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-2xl font-black text-[#f3edff]">
                      Cấu hình slot {selectedSlot?.layoutOrder ?? 1}
                    </p>
                    {selectedSlot ? (
                      <div className="mt-4 rounded border border-[#ff2d85]/70 bg-[#0c0b14] p-6">
                        <div className="grid gap-4">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              aria-checked={selectedSlot.visible}
                              title={selectedSlot.visible ? 'Đang hiển thị trên dashboard' : 'Đang ẩn khỏi dashboard'}
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

                          <Field label="Loại widget">
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
                              Kích thước desktop
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { value: 1, label: '1 ô' },
                                { value: 2, label: '2 ô' },
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
                              1 ô dùng cho chart nhỏ như cột/tròn. 2 ô dùng cho table, heatmap hoặc chart cần đọc rộng.
                              Từ màn hình medium trở xuống, widget luôn tự chuyển thành 1 ô.
                            </p>
                          </div>

                          {selectedSlot.chartType === 'line' || selectedSlot.chartType === 'bar' || selectedSlot.chartType === 'pie' ? (
                            <>
                              <Field label="Dữ liệu muốn xem">
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
                                <Field label={selectedSlot.chartType === 'pie' ? 'Chia lát theo' : 'Nhóm dữ liệu theo'}>
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
                                <Field label="Mốc thời gian">
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
                            <Field label="Kiểu bản đồ">
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
                              Thông tin hiển thị
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
                                  Năm hiển thị
                                </p>
                                <p className="mb-4 border border-[#2b2740] bg-[#191727] px-3 py-2 font-mono text-xs text-[#f3edff]">
                                  {getYearFromDate(selectedSlot.startDate) === String(new Date().getFullYear())
                                    ? `${getYearFromDate(selectedSlot.startDate)} · từ 01/01 đến hôm nay`
                                    : `${getYearFromDate(selectedSlot.startDate)} · từ 01/01 đến 31/12`}
                                </p>
                                <Field label="Chọn năm">
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
                                  Khoảng thời gian
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label="Ngày bắt đầu">
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
                                  <Field label="Ngày kết thúc">
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
                    <Button variant="ghost" className="h-11 px-5" onClick={closeDetailModal}>Hủy</Button>
                    <Button className="h-11 px-6" onClick={saveDetailDraft}>Lưu thay đổi</Button>
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
