import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
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
  { value: 'max_duration', label: 'Thời gian xử lý tối đa' },
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

const chartTypeOptions = [
  { value: 'line', label: 'Biểu đồ đường', icon: TrendingUp },
  { value: 'bar', label: 'Biểu đồ cột', icon: BarChart3 },
  { value: 'pie', label: 'Biểu đồ tròn', icon: PieChart },
  { value: 'heatmap', label: 'Bản đồ nhiệt', icon: Grid3X3 },
  { value: 'table', label: 'Bảng dữ liệu', icon: Table },
] as const;

function withVisibleChartCount(widgets: DashboardWidgetConfig[], count: 2 | 4 | 6) {
  let visibleIndex = 0;
  return widgets.map((widget) => {
    if (widget.type.startsWith('kpi')) return widget;
    visibleIndex += 1;
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

const templates: DashboardTemplate[] = [
  {
    id: 'operations',
    name: 'Vận hành mạng',
    description: 'SYS_MON / TELEMETRY',
    layoutCount: 4,
    apply: (widgets) =>
      withVisibleChartCount(widgets, 4).map((widget) => {
        if (widget.id === 'chart-1') return { ...widget, chartType: 'line', metric: 'count', groupBy: 'none', timeBucket: 'day' };
        if (widget.id === 'chart-2') return { ...widget, chartType: 'pie', metric: 'count', groupBy: 'severity' };
        if (widget.id === 'chart-3') return { ...widget, chartType: 'bar', metric: 'count', groupBy: 'none', timeBucket: 'week' };
        if (widget.id === 'chart-4') return { ...widget, chartType: 'heatmap', metric: 'count', groupBy: 'none' };
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
        if (widget.id === 'chart-1') return { ...widget, chartType: 'bar', metric: 'count', groupBy: 'severity' };
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
        if (widget.id === 'chart-5') return { ...widget, chartType: 'bar', metric: 'affected_devices', groupBy: 'province', visible: true };
        if (widget.id === 'table-1') return { ...widget, chartType: 'table', visible: true };
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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailStep, setDetailStep] = useState<'template' | 'widget'>('template');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftWidgets(widgets);
      setDetailDraftWidgets(widgets);
      setSelectedTemplateId('none');
      setTemplateSearch('');
      setDetailModalOpen(false);
      setDetailStep('template');
      setSelectedSlotId(null);
    }
  }, [isOpen, widgets]);

  const layoutCount = useMemo(() => getVisibleChartCount(detailDraftWidgets), [detailDraftWidgets]);
  const kpiWidgets = detailDraftWidgets.filter((widget) => widget.type.startsWith('kpi'));
  const chartWidgets = detailDraftWidgets.filter((widget) => !widget.type.startsWith('kpi'));
  const selectedSlot = chartWidgets.find((widget) => widget.id === selectedSlotId) ?? chartWidgets[0];
  const filteredTemplates = templates.filter((template) =>
    `${template.name} ${template.description}`.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  if (!isOpen) return null;

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
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
    setSelectedSlotId(draftWidgets.find((widget) => !widget.type.startsWith('kpi'))?.id ?? null);
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
    setSelectedSlotId((current) => current ?? chartWidgets[0]?.id ?? null);
    setDetailStep('widget');
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-white/10 bg-[#151421] text-[#f3edff] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ff2d85]/30 px-6 py-5">
          <h2 className="text-lg font-black text-[#f3edff] drop-shadow-[0_0_10px_rgba(255,45,133,0.55)]">
            Chọn template
          </h2>
          <button className="rounded p-1.5 text-[#ff2d85] hover:bg-[#ff2d85]/10" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <label className="flex h-11 items-center gap-2 rounded border border-[#ff2d85]/40 bg-[#211b2d] px-3 shadow-[0_0_20px_rgba(255,45,133,0.12)]">
            <Search size={20} className="text-[#ff2d85]" />
            <input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Tìm template"
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-xs text-[#f3edff] outline-none placeholder:text-[#777086]"
            />
          </label>

          <div className="space-y-4">
            {filteredTemplates.map((template) => {
              const selected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
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
                  <p className={cn('mt-4 font-mono text-sm font-black', selected ? 'text-[#ff2d85]' : 'text-[#f3edff]')}>
                    {template.name}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-normal text-[#a69db6]">
                    {template.description}
                  </p>
                </button>
              );
            })}

            <div className="relative border border-[#2b2740] bg-[#191727] p-3">
              <span className="absolute -left-px -bottom-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
              <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
              <div className="h-20 border border-[#2b2740] bg-[#151421]" />
              <p className="mt-4 font-mono text-sm font-black">Tập trung terminal</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-normal text-[#a69db6]">
                {extraTemplate.description}
              </p>
            </div>
          </div>

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
                <h2 className="font-mono text-xl font-black">Chỉnh sửa template</h2>
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
                  <p className="font-mono text-xs font-bold uppercase text-[#a69db6]">Dạng layout</p>
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
                          <span className="font-mono text-xs font-bold">{option.count} WIDGET</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs font-bold uppercase text-[#a69db6]">
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
                <h3 className="text-4xl font-black">Chỉnh widget</h3>
                <div className="mt-8 grid gap-7 lg:grid-cols-[260px_1fr]">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase text-[#00f5d4] drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]">
                      Bản đồ layout
                    </p>
                    <div className="mt-4 rounded border border-white/10 bg-[#0c0b14] p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {chartWidgets.slice(0, layoutCount).map((widget, index) => {
                          const selected = selectedSlot?.id === widget.id;
                          return (
                            <button
                              key={widget.id}
                              type="button"
                              onClick={() => setSelectedSlotId(widget.id)}
                              className={cn(
                                'flex aspect-square flex-col items-center justify-center rounded border bg-[#2a2942] transition',
                                selected
                                  ? 'border-[#ff2d85] bg-[#2d0f21] text-[#ff2d85] shadow-[0_0_20px_rgba(255,45,133,0.28)]'
                                  : 'border-transparent text-[#a69db6] hover:border-white/20',
                              )}
                            >
                              <span className="text-2xl font-black">{index + 1}</span>
                              {selected ? <span className="mt-2 text-[10px]">{widget.title}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-sm italic text-[#a69db6]">
                      Chọn một slot trên bản đồ để cấu hình widget ở vị trí đó.
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-lg font-bold text-[#f3edff]">
                      Cấu hình slot {Math.max(1, chartWidgets.findIndex((widget) => widget.id === selectedSlot?.id) + 1)}
                    </p>
                    {selectedSlot ? (
                      <div className="mt-4 rounded border border-[#ff2d85]/70 bg-[#0c0b14] p-6">
                        <div className="grid gap-4">
                          <button
                            type="button"
                            onClick={() =>
                              setDetailDraftWidgets((current) =>
                                updateWidget(current, selectedSlot.id, { visible: !selectedSlot.visible }),
                              )
                            }
                            className={cn(
                              'flex items-center justify-between rounded border p-3 font-mono text-sm transition',
                              selectedSlot.visible
                                ? 'border-[#00f5d4]/50 text-[#00f5d4]'
                                : 'border-white/10 text-[#777086]',
                            )}
                          >
                            <span>{selectedSlot.visible ? 'Đang hiển thị' : 'Đang ẩn'}</span>
                            {selectedSlot.visible ? <Check size={16} /> : null}
                          </button>

                          <Field label="Loại widget">
                            <Select
                              value={selectedSlot.chartType}
                              onChange={(event) =>
                                setDetailDraftWidgets((current) =>
                                  updateWidget(current, selectedSlot.id, { chartType: event.target.value as WidgetSettingsValues['chartType'] }),
                                )
                              }
                            >
                              {chartTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          </Field>

                          {selectedSlot.chartType === 'line' || selectedSlot.chartType === 'bar' || selectedSlot.chartType === 'pie' ? (
                            <>
                              <Field label="Thông tin cần lấy">
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
                              <Field label="Tham số phân nhóm">
                                <Select
                                  value={selectedSlot.groupBy}
                                  onChange={(event) =>
                                    setDetailDraftWidgets((current) =>
                                      updateWidget(current, selectedSlot.id, { groupBy: event.target.value as WidgetSettingsValues['groupBy'] }),
                                    )
                                  }
                                >
                                  {groupScenarios.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </Select>
                              </Field>
                            </>
                          ) : null}

                          <div>
                            <p className="mb-3 font-mono text-sm font-bold uppercase tracking-normal text-[#a69db6]">
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
