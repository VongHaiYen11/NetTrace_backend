import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  Search,
  Plus,
  Trash2,
  ArrowUpDown,
  X,
  ListFilter,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PieChart,
  Table,
  Grid,
  Check,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { decodeTableColumns } from '../utils/columns';
import { normalizePresetFieldsByChartType } from '../utils/presetPayload';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import {
  nettraceApi,
  type PresetSummary,
  type TemplateSummary,
} from '../services/generated/nettrace-api';
import { StateBlock } from '../components/shared/StateBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { NeonBox } from '../components/ui/NeonBox';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Checkbox } from '../components/ui/Checkbox';
import { Field, Input, Select } from '../components/ui/Field';
import {
  type DashboardWidgetConfig,
  TemplateEditorModal,
} from '../features/dashboard/components/GeneralSettingsDrawer';
import type { AppOutletContext } from '../layouts/AppLayout';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateSort = 'date' | 'name' | 'widgets';
type TemplateSortDir = 'asc' | 'desc';

type PresetSortKey = 'preset_name' | 'chart_type';
type PresetSortDir = 'asc' | 'desc';

interface PresetFilter {
  chart_type: string;
}

interface PresetDraft {
  id?: number;
  presetName: string;
  chartType: DashboardWidgetConfig['chartType'];
  metric: string;
  groupBy: string;
  timeBucket: string;
  heatmapMode: 'weekday' | 'calendar';
  tableColumns: string[];
  tablePageSize: number;
  tableRecordLimit: number;
}

type PresetDeleteDialog =
  | { mode: 'confirm'; presets: PresetSummary[] }
  | { mode: 'blocked'; presets: PresetSummary[] };

type TemplateModalState =
  | { mode: 'create'; widgets: DashboardWidgetConfig[] }
  | { mode: 'edit'; templateId: number; templateName: string; widgets: DashboardWidgetConfig[] };

function createTemplateDraftWidgets(): DashboardWidgetConfig[] {
  return [];
}

const DEFAULT_TABLE_PAGE_SIZE = 15;
const DEFAULT_TABLE_RECORD_LIMIT = 200;
const MAX_TABLE_PAGE_SIZE = 200;
const MAX_TABLE_RECORD_LIMIT = 1000;

function normalizeTablePageSize(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_PAGE_SIZE;
  return Math.min(MAX_TABLE_PAGE_SIZE, Math.max(1, Math.trunc(numericValue)));
}

function normalizeTableRecordLimit(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_TABLE_RECORD_LIMIT;
  return Math.min(MAX_TABLE_RECORD_LIMIT, Math.max(1, Math.trunc(numericValue)));
}

function getTemplateWidgets(template: TemplateSummary) {
  if (!template.selected_cards) return createTemplateDraftWidgets();

  try {
    const parsed = JSON.parse(template.selected_cards) as { widgets?: DashboardWidgetConfig[] };
    return Array.isArray(parsed.widgets) ? parsed.widgets : createTemplateDraftWidgets();
  } catch {
    return createTemplateDraftWidgets();
  }
}

function getTemplateKpiCount(template: TemplateSummary) {
  return getTemplateWidgets(template).filter((widget) => widget.type?.startsWith('kpi') && widget.visible !== false).length;
}

// ─── Menu Components ─────────────────────────────────────────────────────────

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

function ControlMenu({
  label,
  icon: Icon,
  accentColor,
  active = false,
  badge,
  children,
}: {
  label: string;
  icon: React.ElementType;
  accentColor: string;
  active?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const highlighted = open || active;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
          highlighted
            ? 'bg-white/[0.06] text-white'
            : 'text-muted hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <Icon size={14} style={{ color: highlighted ? accentColor : undefined }} />
        {label}
        {badge ? (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black text-input-dark"
            style={{ background: accentColor }}
          >
            {badge}
          </span>
        ) : null}
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: highlighted ? accentColor : undefined }}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg bg-panel-light/95 p-4 shadow-xl backdrop-blur-xl">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="px-2 text-[15px] font-semibold text-light">{label}</p>
      {children}
    </div>
  );
}

function MenuOption<T extends string>({
  label,
  value,
  selected,
  onSelect,
  accentColor,
}: {
  label: string;
  value: T;
  selected: boolean;
  onSelect: (value: T) => void;
  accentColor: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
        selected
          ? 'bg-white/[0.07] text-white'
          : 'text-muted hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <span>{label}</span>
      {selected ? <CheckCircle2 size={14} style={{ color: accentColor }} /> : null}
    </button>
  );
}

function SortMenu<T extends string>({
  options,
  value,
  direction,
  onValueChange,
  onDirectionChange,
  accentColor,
}: {
  options: DropdownOption<T>[];
  value: T;
  direction: 'asc' | 'desc';
  onValueChange: (value: T) => void;
  onDirectionChange: (value: 'asc' | 'desc') => void;
  accentColor: string;
}) {
  return (
    <ControlMenu label="Sort" icon={ArrowUpDown} accentColor={accentColor}>
      <div className="space-y-4">
        <MenuSection label="Sort by">
          <div className="grid gap-1">
            {options.map((option) => (
              <MenuOption
                key={option.value}
                label={option.label}
                value={option.value}
                selected={option.value === value}
                onSelect={onValueChange}
                accentColor={accentColor}
              />
            ))}
          </div>
        </MenuSection>

        <MenuSection label="Direction">
          <div className="grid gap-1">
            {(['desc', 'asc'] as const).map((nextDirection) => (
              <button
                key={nextDirection}
                type="button"
                onClick={() => onDirectionChange(nextDirection)}
                className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  direction === nextDirection
                    ? 'bg-white/[0.08] text-white'
                    : 'text-placeholder hover:text-white'
                }`}
              >
                {nextDirection === 'desc' ? 'Descending' : 'Ascending'}
              </button>
            ))}
          </div>
        </MenuSection>
      </div>
    </ControlMenu>
  );
}

function CompactSelect({
  label,
  value,
  options,
  accentColor,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  accentColor: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="px-2 text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-input-dark px-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:ring-2"
        style={{
          borderColor: value ? `${accentColor}70` : undefined,
          '--tw-ring-color': `${accentColor}30`,
        } as React.CSSProperties}
      >
        <option value="">All</option>
        {options.filter(Boolean).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  accentColor,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accentColor: string;
}) {
  return (
    <div className="relative min-w-[13rem] flex-1 sm:flex-none">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] py-2 pl-10 pr-4 font-mono text-xs text-white outline-none transition-all placeholder:text-placeholder hover:border-white/20 focus:ring-2 sm:w-56"
        style={{
          '--tw-ring-color': `${accentColor}25`,
        } as React.CSSProperties}
      />
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={14} style={{ color: accentColor }} />
    </div>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {children}
    </div>
  );
}

function TemplateFilterMenu({
  widgetValue,
  kpiValue,
  onWidgetChange,
  onKpiChange,
}: {
  widgetValue: string;
  kpiValue: string;
  onWidgetChange: (value: string) => void;
  onKpiChange: (value: string) => void;
}) {
  const accentColor = '#ff2d85';
  const activeCount = [widgetValue !== 'all', kpiValue !== 'all'].filter(Boolean).length;

  return (
    <ControlMenu
      label="Filter"
      icon={ListFilter}
      accentColor={accentColor}
      active={activeCount > 0}
      badge={activeCount || undefined}
    >
      <div className="space-y-3">
        <CompactSelect
          label="Widget count"
          value={widgetValue === 'all' ? '' : widgetValue}
          options={['1', '2', '3', '4', '5', '6']}
          accentColor={accentColor}
          onChange={(value) => onWidgetChange(value || 'all')}
        />
        <CompactSelect
          label="KPI card count"
          value={kpiValue === 'all' ? '' : kpiValue}
          options={['0', '1', '2', '3', '4', '5']}
          accentColor={accentColor}
          onChange={(value) => onKpiChange(value || 'all')}
        />
      </div>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            onWidgetChange('all');
            onKpiChange('all');
          }}
          className="mt-4 w-full rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          Clear filters
        </button>
      ) : null}
    </ControlMenu>
  );
}

function PresetFilterMenu({
  value,
  chartTypeOptions,
  onChange,
  onClear,
}: {
  value: PresetFilter;
  chartTypeOptions: string[];
  onChange: (value: PresetFilter) => void;
  onClear: () => void;
}) {
  const accentColor = '#00f5d4';
  const activeCount = [value.chart_type].filter(Boolean).length;

  return (
    <ControlMenu
      label="Filter"
      icon={ListFilter}
      accentColor={accentColor}
      active={activeCount > 0}
      badge={activeCount || undefined}
    >
      <div className="space-y-3">
        <CompactSelect
          label="Chart"
          value={value.chart_type}
          options={chartTypeOptions}
          accentColor={accentColor}
          onChange={(chart_type) => onChange({ ...value, chart_type })}
        />
        <button
          type="button"
          onClick={onClear}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <X size={12} />
          Clear filters
        </button>
      </div>
    </ControlMenu>
  );
}

// ─── Reference Line ───────────────────────────────────────────────────────────

function ReferenceLine({
  description,
}: {
  description: string;
}) {
  return <p className="mb-6 max-w-3xl text-sm leading-6 text-muted">{description}</p>;
}

const tableColumnOptions: Array<{ value: string; label: string }> = [
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

const defaultTableColumns: string[] = [
  'time_created',
  'error_name',
  'status',
  'severity',
  'device_name',
  'description',
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const { activeTemplate, setDashboardWidgets, setActiveTemplate } = useOutletContext<AppOutletContext>();

  // ── Templates data ──────────────────────────────────────────────────────────
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => nettraceApi.listTemplates({ limit: 50, offset: 0 }),
  });

  // ── Reusable presets, including presets not assigned to templates ───────────
  const templateList = templates.data?.data ?? [];

  const presetQueries = useQuery({
    queryKey: ['template-presets'],
    queryFn: () => nettraceApi.listPresets({ limit: 1000, offset: 0 }),
  });

  const allPresets = presetQueries.data?.data ?? [];

  // ── Template local states ───────────────────────────────────────────────────
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateSort, setTemplateSort] = useState<TemplateSort>('date');
  const [templateSortDir, setTemplateSortDir] = useState<TemplateSortDir>('desc');
  const [templateWidgetFilter, setTemplateWidgetFilter] = useState('all');
  const [templateKpiFilter, setTemplateKpiFilter] = useState('all');
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: number; name: string } | null>(null);

  // ── Preset local states ─────────────────────────────────────────────────────
  const [presetSearch, setPresetSearch] = useState('');
  const [presetSortKey, setPresetSortKey] = useState<PresetSortKey>('chart_type');
  const [presetSortDir, setPresetSortDir] = useState<PresetSortDir>('asc');
  const [presetFilter, setPresetFilter] = useState<PresetFilter>({
    chart_type: '',
  });
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<number>>(() => new Set());
  const [presetDeleteDialog, setPresetDeleteDialog] = useState<PresetDeleteDialog | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetHeatmapMode, setPresetHeatmapMode] = useState<'weekday' | 'calendar'>('weekday');
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [presetDraft, setPresetDraft] = useState<PresetDraft>({
    presetName: '',
    chartType: 'line',
    metric: 'count',
    groupBy: 'none',
    timeBucket: 'day',
    heatmapMode: 'weekday',
    tableColumns: defaultTableColumns,
    tablePageSize: DEFAULT_TABLE_PAGE_SIZE,
    tableRecordLimit: DEFAULT_TABLE_RECORD_LIMIT,
  });

  // ── Filter / sort templates ─────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    if (!templates.data?.data) return [];
    return templates.data.data
      .filter((t) => {
        const widgetCount = t.number_of_widgets || 0;
        const kpiCount = getTemplateKpiCount(t);
        if (!t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false;
        if (templateWidgetFilter !== 'all' && widgetCount !== Number(templateWidgetFilter)) return false;
        if (templateKpiFilter !== 'all' && kpiCount !== Number(templateKpiFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        let result = 0;
        if (templateSort === 'name') {
          result = a.name.localeCompare(b.name);
        } else if (templateSort === 'widgets') {
          result = a.number_of_widgets - b.number_of_widgets;
        } else {
          result = new Date(a.time_updated).getTime() - new Date(b.time_updated).getTime();
        }
        return templateSortDir === 'asc' ? result : -result;
      });
  }, [templates.data?.data, templateSearch, templateSort, templateSortDir, templateWidgetFilter, templateKpiFilter]);

  // ── Filter / sort presets ───────────────────────────────────────────────────
  const filteredPresets = useMemo(() => {
    return allPresets
      .filter((p) => {
        const searchStr = `${p.preset_name ?? ''} ${p.chart_type}`.toLowerCase();
        if (presetSearch && !searchStr.includes(presetSearch.toLowerCase())) return false;
        if (presetFilter.chart_type && p.chart_type !== presetFilter.chart_type) return false;
        return true;
      })
      .sort((a, b) => {
        const valA = (a[presetSortKey] ?? '').toString().toLowerCase();
        const valB = (b[presetSortKey] ?? '').toString().toLowerCase();
        const result = valA.localeCompare(valB);
        return presetSortDir === 'asc' ? result : -result;
      });
  }, [allPresets, presetSearch, presetFilter, presetSortKey, presetSortDir]);
  const visiblePresetIds = useMemo(
    () => filteredPresets.map((preset) => preset.preset_id),
    [filteredPresets],
  );
  const allVisiblePresetsSelected =
    visiblePresetIds.length > 0 && visiblePresetIds.every((id) => selectedPresetIds.has(id));
  const someVisiblePresetsSelected = visiblePresetIds.some((id) => selectedPresetIds.has(id));

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await nettraceApi.deleteTemplate(templateToDelete.id);
      if (activeTemplate && activeTemplate.id === `db:${templateToDelete.id}`) {
        setActiveTemplate(null);
        setDashboardWidgets([]);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['templates'] }),
        queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-widget-presets'] }),
      ]);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const openCreateTemplateFlow = () => {
    setTemplateModal({ mode: 'create', widgets: createTemplateDraftWidgets() });
  };

  const openEditTemplateFlow = (template: TemplateSummary) => {
    setTemplateModal({
      mode: 'edit',
      templateId: template.template_id,
      templateName: template.name,
      widgets: getTemplateWidgets(template),
    });
  };

  const handleTemplateSaved = async (saved: { id: string; name: string; widgets: DashboardWidgetConfig[] }) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['templates'] }),
      queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
    ]);
    if (activeTemplate && activeTemplate.id === saved.id) {
      setActiveTemplate({ id: saved.id, name: saved.name });
      setDashboardWidgets(saved.widgets);
    }
    setTemplateModal(null);
  };

  const togglePresetSelection = (presetId: number) => {
    setSelectedPresetIds((current) => {
      const next = new Set(current);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      return next;
    });
  };

  const toggleVisiblePresets = () => {
    setSelectedPresetIds((current) => {
      const next = new Set(current);
      if (allVisiblePresetsSelected) {
        visiblePresetIds.forEach((id) => next.delete(id));
      } else {
        visiblePresetIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const getYearFromDate = (value: string) => {
    return value ? value.slice(0, 4) : String(new Date().getFullYear());
  };

  const getYearDateRange = (yearValue: string) => {
    const year = Number(yearValue) || new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: year === currentYear ? new Date().toISOString().slice(0, 10) : `${year}-12-31`,
    };
  };

  const openPresetModal = (preset?: typeof allPresets[0]) => {
    if (preset) {
      setPresetDraft({
        id: preset.preset_id,
        presetName: preset.preset_name || '',
        chartType: preset.chart_type as any,
        metric: preset.metric || 'count',
        groupBy: preset.group_by || (preset.chart_type === 'pie' ? 'severity' : 'none'),
        timeBucket: preset.time_bucket || 'day',
        heatmapMode: (preset.heatmap_mode as 'weekday' | 'calendar') || 'weekday',
        tableColumns: decodeTableColumns(preset.table_columns) || defaultTableColumns,
        tablePageSize: preset.table_page_size ?? DEFAULT_TABLE_PAGE_SIZE,
        tableRecordLimit: preset.table_record_limit ?? DEFAULT_TABLE_RECORD_LIMIT,
      });
      setPresetHeatmapMode((preset.heatmap_mode as 'weekday' | 'calendar') || 'weekday');
    } else {
      setPresetDraft({
        presetName: '',
        chartType: 'line',
        metric: 'count',
        groupBy: 'none',
        timeBucket: 'day',
        heatmapMode: 'weekday',
        tableColumns: defaultTableColumns,
        tablePageSize: DEFAULT_TABLE_PAGE_SIZE,
        tableRecordLimit: DEFAULT_TABLE_RECORD_LIMIT,
      });
      setPresetHeatmapMode('weekday');
    }
    setPresetModalOpen(true);
  };

  const handleSavePreset = async () => {
    setCreatingPreset(true);
    try {
      const payload = {
        preset_name: presetDraft.presetName.trim(),
        chart_type: presetDraft.chartType,
        ...normalizePresetFieldsByChartType({
          chartType: presetDraft.chartType,
          metric: presetDraft.metric,
          groupBy: presetDraft.groupBy,
          timeBucket: presetDraft.timeBucket,
          heatmapMode: presetDraft.heatmapMode,
          tableColumns: presetDraft.tableColumns,
          tablePageSize: presetDraft.tablePageSize,
          tableRecordLimit: presetDraft.tableRecordLimit,
        }),
      };

      if (presetDraft.id) {
        await nettraceApi.updatePreset(presetDraft.id, payload);
      } else {
        await nettraceApi.createPreset(payload);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-widget-presets'] }),
      ]);
      setPresetModalOpen(false);
      setPresetDraft((current) => ({ ...current, presetName: '', id: undefined }));
      toast.success(`Reusable preset ${presetDraft.id ? 'updated' : 'created'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${presetDraft.id ? 'update' : 'create'} preset.`);
    } finally {
      setCreatingPreset(false);
    }
  };

  const openPresetDeleteDialog = () => {
    if (selectedPresetIds.size === 0) return;
    const selectedPresets = allPresets.filter((preset) => selectedPresetIds.has(preset.preset_id));
    const usedPresets = selectedPresets.filter((preset) => preset.template_id);
    setPresetDeleteDialog({
      mode: usedPresets.length > 0 ? 'blocked' : 'confirm',
      presets: usedPresets.length > 0 ? usedPresets : selectedPresets,
    });
  };

  const handleDeletePresets = async () => {
    if (!presetDeleteDialog || presetDeleteDialog.mode !== 'confirm') return;

    try {
      await nettraceApi.deletePresets(presetDeleteDialog.presets.map((preset) => preset.preset_id));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-widget-presets'] }),
      ]);
      setSelectedPresetIds(new Set());
      setPresetDeleteDialog(null);
      toast.success('Presets deleted successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete presets.');
    }
  };

  const presetIsLoading = presetQueries.isLoading;
  const presetIsError = presetQueries.isError;

  // ── Chart type options derived from actual data ─────────────────────────────
  const chartTypeOptions = useMemo(() => {
    const types = new Set(allPresets.map((p) => p.chart_type));
    return ['', ...Array.from(types)];
  }, [allPresets]);

  const templateSortOptions: DropdownOption<TemplateSort>[] = [
    { value: 'date', label: 'Date' },
    { value: 'name', label: 'Name' },
    { value: 'widgets', label: 'Widgets' },
  ];

  const presetSortOptions: DropdownOption<PresetSortKey>[] = [
    { value: 'preset_name', label: 'Preset name' },
    { value: 'chart_type', label: 'Chart type' },
  ];

  const templateGuideDescription =
    'Templates save the dashboard layout, widget slots, and chart setup so the same view can be applied again later.';

  const presetGuideDescription =
    'Presets are saved widget configurations, including chart type, date range, and alarm filters collected from templates.';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageShell>

      <PageHeader
        title="Manage"
        accent="templates & presets"
        description="Manage and organize custom dashboard templates and preset configurations across the network."
      />

      {/* ───────────────── Templates Section ───────────────── */}
      <section>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-2xl font-bold uppercase tracking-widest text-primary drop-shadow-glow-primary">
            Templates
          </h2>
          <Toolbar>
            <TemplateFilterMenu
              widgetValue={templateWidgetFilter}
              kpiValue={templateKpiFilter}
              onWidgetChange={setTemplateWidgetFilter}
              onKpiChange={setTemplateKpiFilter}
            />
            <SortMenu
              options={templateSortOptions}
              value={templateSort}
              direction={templateSortDir}
              onValueChange={setTemplateSort}
              onDirectionChange={setTemplateSortDir}
              accentColor="#ff2d85"
            />
            <SearchInput
              value={templateSearch}
              onChange={setTemplateSearch}
              placeholder="Search templates"
              accentColor="#ff2d85"
            />
          </Toolbar>
        </div>

        {/* Reference line */}
        <div className="mt-4">
          <ReferenceLine description={templateGuideDescription} />
        </div>

        {/* Templates Grid */}
        {templates.isLoading ? (
          <StateBlock state="loading" title="Loading templates" />
        ) : templates.isError ? (
          <StateBlock
            state="error"
            title="No template data"
            description="The template endpoint did not return a valid response."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Create Template Card */}
            <button
              onClick={openCreateTemplateFlow}
              className="group relative flex flex-col items-center justify-center h-72 border-2 border-dashed border-primary/30 rounded-xl bg-panel-light/30 hover:bg-primary/5 hover:border-primary transition-all duration-300 shadow-glow-primary-inset"
            >
              <div className="w-14 h-14 rounded-full border border-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-glow-primary bg-primary/5">
                <Plus className="text-primary" size={32} />
              </div>
              <span className="font-heading font-bold text-white text-base">New Template</span>
            </button>

            {/* Render List */}
            {filteredTemplates.map((template) => {
              const widgetCount = template.number_of_widgets || 0;
              const isActive = activeTemplate?.id === `db:${template.template_id}`;
              const formattedDate = formatDistanceToNow(parseISO(template.time_updated), {
                addSuffix: true,
              })
                .replace('less than a minute', '< 1 m')
                .replace('about ', '')
                .replace('almost ', '')
                .replace('over ', '')
                .replace(/ months?/, ' mo')
                .replace(/ years?/, ' y')
                .replace(/ days?/, ' d')
                .replace(/ hours?/, ' h')
                .replace(/ minutes?/, ' min')
                .replace(/ seconds?/, ' s');
              const kpiCount = getTemplateKpiCount(template);

              return (
                <div
                  key={template.template_id}
                  onClick={() => openEditTemplateFlow(template)}
                  className="group relative flex h-72 cursor-pointer flex-col overflow-hidden rounded-lg border border-primary/30 bg-panel-light transition-all duration-300 hover:border-secondary/50 hover:shadow-glow-secondary"
                >
                  {/* Thumbnail Area */}
                  <div className="relative h-32 w-full overflow-hidden border-b border-border/70 bg-input/70">
                    <div className="absolute inset-4 flex flex-col gap-2 rounded border border-secondary/20 p-2">
                      <div className="h-3 w-1/3 rounded bg-secondary/10" />
                      <div className="flex flex-1 gap-2">
                        <div className="flex-1 rounded border border-primary/20 bg-primary/5" />
                        <div className="w-1/3 rounded border border-secondary/20 bg-secondary/5" />
                      </div>
                    </div>
                    {isActive ? (
                      <span className="absolute right-2 top-2 rounded border border-secondary/50 bg-secondary-dark px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-secondary shadow-glow-secondary">
                        Active
                      </span>
                    ) : null}
                  </div>

                  {/* Content Area */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="truncate pr-2 font-heading text-xl font-bold text-white transition-colors group-hover:text-secondary">
                        {template.name}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateToDelete({ id: template.template_id, name: template.name });
                        }}
                        className="shrink-0 text-muted opacity-0 transition-colors hover:text-primary group-hover:opacity-100"
                        title="Delete template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex-1" />

                    {/* Footer */}
                    <div className="mt-auto flex items-end justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {widgetCount} Widgets
                        </span>
                        {kpiCount > 0 ? (
                          <span className="rounded border border-secondary/20 bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                            {kpiCount} KPIs
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-muted/50">
                        Mod: {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────────────── Presets Section ───────────────── */}
      <section className="mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="font-headline text-2xl font-bold uppercase tracking-widest text-secondary drop-shadow-glow-secondary">
            Presets
          </h2>
          <Toolbar>
            <Button
              variant="secondary"
              className="h-10 border-secondary/70 text-secondary hover:bg-secondary/10"
              onClick={() => openPresetModal()}
            >
              <Plus size={14} />
              Add preset
            </Button>
            <PresetFilterMenu
              value={presetFilter}
              chartTypeOptions={chartTypeOptions}
              onChange={setPresetFilter}
              onClear={() => setPresetFilter({ chart_type: '' })}
            />
            <SortMenu
              options={presetSortOptions}
              value={presetSortKey}
              direction={presetSortDir}
              onValueChange={setPresetSortKey}
              onDirectionChange={setPresetSortDir}
              accentColor="#00f5d4"
            />
            <SearchInput
              value={presetSearch}
              onChange={setPresetSearch}
              placeholder="Search presets"
              accentColor="#00f5d4"
            />
          </Toolbar>
        </div>

        {/* Reference line */}
        <div className="mt-4">
          <ReferenceLine description={presetGuideDescription} />
        </div>

        {/* Presets Table */}
        {presetIsLoading ? (
          <StateBlock state="loading" title="Loading presets from templates" />
        ) : presetIsError ? (
          <StateBlock
            state="error"
            title="Failed to load presets"
            description="Could not retrieve preset data from the template endpoints."
          />
        ) : (
          <div className="overflow-hidden border border-border rounded-xl bg-panel-light/60 backdrop-blur-sm shadow-xl">
            {selectedPresetIds.size > 0 ? (
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-muted">
                <span>{selectedPresetIds.size} selected</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedPresetIds(new Set())}
                    className="font-semibold text-secondary transition hover:text-secondary-light"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={openPresetDeleteDialog}
                    className="font-semibold text-red-400 transition hover:text-red-300"
                  >
                    Delete selected
                  </button>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-input/60 border-b border-border">
                    <th className="w-12 px-4 py-4">
                      <Checkbox
                        aria-label="Select all visible presets"
                        checked={allVisiblePresetsSelected}
                        indeterminate={someVisiblePresetsSelected && !allVisiblePresetsSelected}
                        onChange={toggleVisiblePresets}
                      />
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Preset Name
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Chart Type
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredPresets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-sm text-muted">
                        {allPresets.length === 0
                          ? 'No reusable presets have been created yet.'
                          : 'No presets match the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPresets.map((preset) => {
                      return (
                        <tr
                          key={preset.preset_id}
                          className="group transition-colors hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => openPresetModal(preset)}
                        >
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              aria-label={`Select preset ${preset.preset_id}`}
                              checked={selectedPresetIds.has(preset.preset_id)}
                              onChange={() => togglePresetSelection(preset.preset_id)}
                            />
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-muted">
                            {preset.preset_name ?? '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs text-muted">
                              {preset.chart_type}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ───────────────── Delete Confirmation Modal ───────────────── */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm">
            <NeonBox className="p-6 rounded-lg bg-panel-light shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-heading font-bold text-primary drop-shadow-glow-primary">
                  Delete Template
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setTemplateToDelete(null)} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
              <p className="text-sm text-muted mb-6">
                Are you sure you want to delete <strong className="text-white">"{templateToDelete.name}"</strong>? This node will be purged from the neural network.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setTemplateToDelete(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDeleteTemplate}>
                  Confirm
                </Button>
              </div>
            </NeonBox>
          </div>
        </div>
      )}

      {presetDeleteDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm">
            <NeonBox className="p-6 rounded-lg bg-panel-light shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-heading font-bold text-primary drop-shadow-glow-primary">
                  {presetDeleteDialog.mode === 'blocked' ? 'Preset In Use' : 'Delete Preset'}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setPresetDeleteDialog(null)} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
              {presetDeleteDialog.mode === 'blocked' ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    This preset is currently used by a template and cannot be deleted. Remove it from the template first.
                  </p>
                  <div className="max-h-36 overflow-y-auto border border-border bg-input p-3">
                    {presetDeleteDialog.presets.map((preset) => (
                      <div key={preset.preset_id} className="font-mono text-xs text-muted">
                        <span className="text-light">{preset.preset_name || `Preset ${preset.preset_id}`}</span>
                        {preset.template_name ? ` · ${preset.template_name}` : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted mb-6">
                  Are you sure you want to delete {presetDeleteDialog.presets.length === 1 ? (
                    <strong className="text-white">
                      "{presetDeleteDialog.presets[0].preset_name || `Preset ${presetDeleteDialog.presets[0].preset_id}`}"
                    </strong>
                  ) : (
                    <strong className="text-white">{presetDeleteDialog.presets.length} presets</strong>
                  )}? This cannot be undone.
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setPresetDeleteDialog(null)}>
                  {presetDeleteDialog.mode === 'blocked' ? 'Close' : 'Cancel'}
                </Button>
                {presetDeleteDialog.mode === 'confirm' ? (
                  <Button variant="danger" onClick={handleDeletePresets}>
                    Confirm
                  </Button>
                ) : null}
              </div>
            </NeonBox>
          </div>
        </div>
      ) : null}

      {presetModalOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={() => setPresetModalOpen(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setPresetModalOpen(false)}>
            <div
              className="relative flex max-h-[90vh] w-full max-w-[800px] flex-col rounded-md border border-white/10 bg-panel-light text-light shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                  Preset configuration
                </p>
                <h2 className="mt-1 font-mono text-3xl font-black text-light">
                  {presetDraft.id ? 'Edit Preset' : 'Add Preset'}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted">
                  Save a reusable widget configuration now and assign it to a template later.
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-muted hover:bg-white/10 hover:text-white"
                onClick={() => setPresetModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

             <div className="flex-1 overflow-y-auto px-6 py-6">
              <div>
                <div className="grid gap-4">
                    <Field label="Preset name" hint="Saving changes updates the preset name shown on the widget.">
                      <Input
                        value={presetDraft.presetName}
                        onChange={(event) =>
                          setPresetDraft((current) => ({ ...current, presetName: event.target.value }))
                        }
                        placeholder="Critical router alarms"
                      />
                    </Field>

                    <div>
                      <p className="mb-3 font-mono text-base font-black tracking-normal text-secondary">
                        Preset chart type
                      </p>
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { id: 'line', label: 'Line', icon: TrendingUp },
                          { id: 'bar', label: 'Bar', icon: BarChart3 },
                          { id: 'pie', label: 'Pie', icon: PieChart },
                          { id: 'table', label: 'Table', icon: Table },
                          { id: 'heatmap', label: 'Heatmap', icon: Grid },
                        ].map((type) => {
                          const Icon = type.icon;
                          const isSelected = presetDraft.chartType === type.id;
                          return (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() =>
                                setPresetDraft((current) => {
                                  let heatmapMode = current.heatmapMode;
                                  if (type.id === 'heatmap' && current.chartType !== 'heatmap') {
                                    heatmapMode = 'weekday';
                                    setPresetHeatmapMode('weekday');
                                  }
                                  return {
                                    ...current,
                                    chartType: type.id as any,
                                    heatmapMode,
                                  };
                                })
                              }
                              className={`flex min-h-[86px] flex-col items-center justify-center rounded border p-3 transition ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary shadow-glow-primary'
                                  : 'border-border bg-input text-muted hover:border-primary/60 hover:text-light'
                              }`}
                            >
                              <Icon size={20} />
                              <span className="mt-2 font-mono text-xs font-bold tracking-normal">
                                {type.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {presetDraft.chartType === 'line' || presetDraft.chartType === 'bar' || presetDraft.chartType === 'pie' ? (
                      <>
                        <Field label="Data">
                          <Select
                            value={presetDraft.metric}
                            onChange={(event) =>
                              setPresetDraft((current) => ({
                                ...current,
                                metric: event.target.value,
                              }))
                            }
                          >
                            <option value="count">Alarm count</option>
                            <option value="avg_duration">Avg handling time</option>
                            <option value="max_duration">Max handling time</option>
                            <option value="affected_devices">Affected devices</option>
                          </Select>
                        </Field>
                        {presetDraft.chartType === 'bar' || presetDraft.chartType === 'pie' ? (
                          <Field label={presetDraft.chartType === 'pie' ? 'Slice by' : 'Group by'}>
                            <Select
                              value={presetDraft.groupBy}
                              onChange={(event) =>
                                setPresetDraft((current) => ({
                                  ...current,
                                  groupBy: event.target.value,
                                }))
                              }
                            >
                              {presetDraft.chartType === 'bar' ? (
                                <option value="none">No group (time series)</option>
                              ) : null}
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
                        {presetDraft.chartType === 'line' || (presetDraft.chartType === 'bar' && presetDraft.groupBy === 'none') ? (
                          <Field label="Time bucket">
                            <Select
                              value={presetDraft.timeBucket}
                              onChange={(event) =>
                                setPresetDraft((current) => ({
                                  ...current,
                                  timeBucket: event.target.value,
                                }))
                              }
                            >
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

                    {presetDraft.chartType === 'heatmap' ? (
                      <Field label="Heatmap mode">
                        <Select
                          value={presetHeatmapMode}
                          onChange={(event) => {
                            const mode = event.target.value as 'weekday' | 'calendar';
                            setPresetHeatmapMode(mode);
                            setPresetDraft((current) => ({
                              ...current,
                              heatmapMode: mode,
                            }));
                          }}
                        >
                          <option value="weekday">Weekday heatmap</option>
                          <option value="calendar">Year heatmap</option>
                        </Select>
                      </Field>
                    ) : null}

                    {presetDraft.chartType === 'table' ? (
                      <div>
                        <p className="mb-3 font-mono text-base font-black tracking-normal text-secondary">
                          Table columns
                        </p>
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Records per page" labelVariant="nested">
                              <Input
                                type="number"
                                min={1}
                                max={MAX_TABLE_PAGE_SIZE}
                                value={presetDraft.tablePageSize}
                                onChange={(event) =>
                                  setPresetDraft((current) => ({
                                    ...current,
                                    tablePageSize: normalizeTablePageSize(event.target.value),
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Number of records" labelVariant="nested">
                              <Input
                                type="number"
                                min={1}
                                max={MAX_TABLE_RECORD_LIMIT}
                                value={presetDraft.tableRecordLimit}
                                onChange={(event) =>
                                  setPresetDraft((current) => ({
                                    ...current,
                                    tableRecordLimit: normalizeTableRecordLimit(event.target.value),
                                  }))
                                }
                              />
                            </Field>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setPresetDraft((current) => ({
                                  ...current,
                                  tableColumns: defaultTableColumns,
                                }))
                              }
                            >
                              Default
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setPresetDraft((current) => ({
                                  ...current,
                                  tableColumns: [],
                                }))
                              }
                            >
                              Deselect all
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setPresetDraft((current) => ({
                                  ...current,
                                  tableColumns: tableColumnOptions.map((item) => item.value),
                                }))
                              }
                            >
                              Select all
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {tableColumnOptions.map((option) => {
                              const checked = presetDraft.tableColumns.includes(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    setPresetDraft((current) => {
                                      const cols = current.tableColumns.includes(option.value)
                                        ? current.tableColumns.filter((item) => item !== option.value)
                                        : [...current.tableColumns, option.value];
                                      return {
                                        ...current,
                                        tableColumns: cols,
                                      };
                                    })
                                  }
                                  className={cn(
                                    'flex items-center justify-between border p-3 text-left font-mono text-sm transition',
                                    checked
                                      ? 'border-secondary/40 bg-secondary/5 text-light'
                                      : 'border-border bg-input text-muted hover:border-primary/45',
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
                      </div>
                    ) : null}

                  </div>
                </div>
              </div>

            <div className="mt-auto flex justify-end gap-3 border-t border-white/10 px-6 py-4 bg-panel-light/95 sticky bottom-0">
              <Button variant="ghost" className="h-11 px-5" onClick={() => setPresetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="h-11 px-6"
                onClick={handleSavePreset}
                disabled={creatingPreset || !presetDraft.presetName.trim()}
              >
                {creatingPreset ? 'Saving...' : presetDraft.id ? 'Save changes' : 'Add preset'}
              </Button>
            </div>
          </div>
        </div>
      </>
    ) : null}

      {templateModal ? (
        <TemplateEditorModal
          isOpen
          mode={templateModal.mode}
          widgets={templateModal.widgets}
          templateId={templateModal.mode === 'edit' ? templateModal.templateId : undefined}
          templateName={templateModal.mode === 'edit' ? templateModal.templateName : undefined}
          onClose={() => setTemplateModal(null)}
          onSaved={handleTemplateSaved}
        />
      ) : null}
    </PageShell>
  );
}
