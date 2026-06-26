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
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import {
  nettraceApi,
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
type TemplateWidgetFilter = 'all' | 'with-widgets' | 'with-kpis';

type PresetSortKey = 'chart_type' | 'severity' | 'status' | 'vendor' | 'device_type';
type PresetSortDir = 'asc' | 'desc';

interface PresetFilter {
  chart_type: string;
  severity: string;
  status: string;
}

interface PresetDraft {
  id?: number;
  presetName: string;
  chartType: DashboardWidgetConfig['chartType'];
  startDate: string;
  endDate: string;
  status: string;
  severity: string;
  errorCode: string;
  vendor: string;
  deviceType: string;
}

type TemplateModalState =
  | { mode: 'create'; widgets: DashboardWidgetConfig[] }
  | { mode: 'edit'; templateId: number; templateName: string; widgets: DashboardWidgetConfig[] };

function createTemplateDraftWidgets(): DashboardWidgetConfig[] {
  return [];
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

function FilterChip({
  label,
  active,
  accentColor,
  onClick,
}: {
  label: string;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
        active ? 'bg-white/[0.07] text-white' : 'text-muted hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {label}
    </button>
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
  value,
  counts,
  onChange,
}: {
  value: TemplateWidgetFilter;
  counts: { all: number; widgets: number; kpis: number };
  onChange: (value: TemplateWidgetFilter) => void;
}) {
  const accentColor = '#ff2d85';

  return (
    <ControlMenu
      label="Filter"
      icon={ListFilter}
      accentColor={accentColor}
      active={value !== 'all'}
      badge={value !== 'all' ? 1 : undefined}
    >
      <MenuSection label="Widgets">
        <div className="grid gap-1">
          <FilterChip label={`All (${counts.all})`} active={value === 'all'} accentColor={accentColor} onClick={() => onChange('all')} />
          <FilterChip label={`Has widgets (${counts.widgets})`} active={value === 'with-widgets'} accentColor={accentColor} onClick={() => onChange('with-widgets')} />
          <FilterChip label={`Has KPI cards (${counts.kpis})`} active={value === 'with-kpis'} accentColor={accentColor} onClick={() => onChange('with-kpis')} />
        </div>
      </MenuSection>
    </ControlMenu>
  );
}

function PresetFilterMenu({
  value,
  chartTypeOptions,
  severityOptions,
  statusOptions,
  onChange,
  onClear,
}: {
  value: PresetFilter;
  chartTypeOptions: string[];
  severityOptions: string[];
  statusOptions: string[];
  onChange: (value: PresetFilter) => void;
  onClear: () => void;
}) {
  const accentColor = '#00f5d4';
  const activeCount = [value.chart_type, value.severity, value.status].filter(Boolean).length;

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
        <CompactSelect
          label="Severity"
          value={value.severity}
          options={severityOptions}
          accentColor={accentColor}
          onChange={(severity) => onChange({ ...value, severity })}
        />
        <CompactSelect
          label="Status"
          value={value.status}
          options={statusOptions}
          accentColor={accentColor}
          onChange={(status) => onChange({ ...value, status })}
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
  const [templateWidgetFilter, setTemplateWidgetFilter] = useState<TemplateWidgetFilter>('all');
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: number; name: string } | null>(null);

  const templateCounts = useMemo(() => {
    const data = templates.data?.data || [];
    let widgets = 0;
    let kpis = 0;
    data.forEach(t => {
      const widgetCount = t.number_of_widgets || 0;
      if (widgetCount > 0) widgets++;
      const parsedWidgets = getTemplateWidgets(t);
      if (parsedWidgets.filter(w => w.type && w.type.startsWith('kpi')).length > 0) kpis++;
    });
    return { all: data.length, widgets, kpis };
  }, [templates.data?.data]);

  // ── Preset local states ─────────────────────────────────────────────────────
  const [presetSearch, setPresetSearch] = useState('');
  const [presetSortKey, setPresetSortKey] = useState<PresetSortKey>('chart_type');
  const [presetSortDir, setPresetSortDir] = useState<PresetSortDir>('asc');
  const [presetFilter, setPresetFilter] = useState<PresetFilter>({
    chart_type: '',
    severity: '',
    status: '',
  });
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<number>>(() => new Set());
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [presetDraft, setPresetDraft] = useState<PresetDraft>({
    presetName: '',
    chartType: 'line',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    status: '',
    severity: '',
    errorCode: '',
    vendor: '',
    deviceType: '',
  });

  // ── Filter / sort templates ─────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    if (!templates.data?.data) return [];
    return templates.data.data
      .filter((t) => {
        const widgetCount = t.number_of_widgets || 0;
        if (!t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false;
        if (templateWidgetFilter === 'with-widgets') return widgetCount > 0;
        if (templateWidgetFilter === 'with-kpis') {
          const parsedWidgets = getTemplateWidgets(t);
          return parsedWidgets.filter(w => w.type && w.type.startsWith('kpi')).length > 0;
        }
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
  }, [templates.data?.data, templateSearch, templateSort, templateSortDir, templateWidgetFilter]);

  // ── Filter / sort presets ───────────────────────────────────────────────────
  const filteredPresets = useMemo(() => {
    return allPresets
      .filter((p) => {
        const searchStr = `${p.preset_name ?? ''} ${p.chart_type} ${p.severity ?? ''} ${p.status ?? ''} ${p.vendor ?? ''} ${p.device_type ?? ''}`.toLowerCase();
        if (presetSearch && !searchStr.includes(presetSearch.toLowerCase())) return false;
        if (presetFilter.chart_type && p.chart_type !== presetFilter.chart_type) return false;
        if (presetFilter.severity && (p.severity ?? '') !== presetFilter.severity) return false;
        if (presetFilter.status && (p.status ?? '') !== presetFilter.status) return false;
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
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
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

  const openPresetModal = (preset?: typeof allPresets[0]) => {
    if (preset) {
      setPresetDraft({
        id: preset.preset_id,
        presetName: preset.preset_name || '',
        chartType: preset.chart_type as any,
        startDate: preset.start_date ? new Date(preset.start_date).toISOString().slice(0, 10) : '',
        endDate: preset.end_date ? new Date(preset.end_date).toISOString().slice(0, 10) : '',
        status: preset.status || '',
        severity: preset.severity || '',
        errorCode: preset.error_code || '',
        vendor: preset.vendor || '',
        deviceType: preset.device_type || '',
      });
    } else {
      setPresetDraft({
        presetName: '',
        chartType: 'line',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        status: '',
        severity: '',
        errorCode: '',
        vendor: '',
        deviceType: '',
      });
    }
    setPresetModalOpen(true);
  };

  const handleSavePreset = async () => {
    setCreatingPreset(true);
    try {
      const payload = {
        preset_name: presetDraft.presetName.trim(),
        position: 0,
        chart_type: presetDraft.chartType,
        start_date: presetDraft.startDate || null,
        end_date: presetDraft.endDate || null,
        status: presetDraft.status || null,
        severity: presetDraft.severity || null,
        error_code: presetDraft.errorCode || null,
        vendor: presetDraft.vendor || null,
        device_type: presetDraft.deviceType || null,
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

  const handleDeletePresets = async () => {
    if (selectedPresetIds.size === 0) return;
    if (!confirm('Are you sure you want to delete the selected presets?')) return;
    
    try {
      await nettraceApi.deletePresets(Array.from(selectedPresetIds));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-widget-presets'] }),
      ]);
      setSelectedPresetIds(new Set());
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

  const severityOptions = useMemo(() => {
    const vals = new Set(allPresets.map((p) => p.severity ?? '').filter(Boolean));
    return ['', ...Array.from(vals)];
  }, [allPresets]);

  const statusOptions = useMemo(() => {
    const vals = new Set(allPresets.map((p) => p.status ?? '').filter(Boolean));
    return ['', ...Array.from(vals)];
  }, [allPresets]);

  const templateSortOptions: DropdownOption<TemplateSort>[] = [
    { value: 'date', label: 'Date' },
    { value: 'name', label: 'Name' },
    { value: 'widgets', label: 'Widgets' },
  ];

  const presetSortOptions: DropdownOption<PresetSortKey>[] = [
    { value: 'chart_type', label: 'Chart type' },
    { value: 'severity', label: 'Severity' },
    { value: 'status', label: 'Status' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'device_type', label: 'Device' },
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
            <TemplateFilterMenu value={templateWidgetFilter} counts={templateCounts} onChange={setTemplateWidgetFilter} />
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
              const parsedWidgets = getTemplateWidgets(template);
              const kpiCount = parsedWidgets.filter((w) => w.type && w.type.startsWith('kpi')).length;

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
              severityOptions={severityOptions}
              statusOptions={statusOptions}
              onChange={setPresetFilter}
              onClear={() => setPresetFilter({ chart_type: '', severity: '', status: '' })}
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
                    onClick={handleDeletePresets}
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
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Severity
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Status
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Vendor
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Device
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted font-bold">
                      Template
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredPresets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-muted">
                        {allPresets.length === 0
                          ? 'No reusable presets have been created yet.'
                          : 'No presets match the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPresets.map((preset) => {
                      const severityTone =
                        preset.severity === 'critical'
                          ? 'red'
                          : preset.severity === 'major'
                          ? 'orange'
                          : preset.severity === 'minor'
                          ? 'green'
                          : preset.severity === 'warning'
                          ? 'yellow'
                          : 'blue';

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
                          <td className="px-6 py-4">
                            {preset.severity ? (
                              <Badge tone={severityTone as 'red' | 'orange' | 'green' | 'yellow' | 'blue'}>{preset.severity}</Badge>
                            ) : (
                              <span className="text-placeholder text-xs font-mono">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {preset.status ? (
                              <Badge tone={preset.status === 'active' ? 'green' : 'neutral'}>{preset.status}</Badge>
                            ) : (
                              <span className="text-placeholder text-xs font-mono">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-muted">
                            {preset.vendor ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-muted">
                            {preset.device_type ?? '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono text-muted/60 italic">
                              {preset.template_name ?? 'Unassigned'}
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

      {presetModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-secondary/30 bg-panel-light p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-light">{presetDraft.id ? 'Edit Preset' : 'Add Preset'}</h3>
                <p className="mt-1 text-sm text-muted">
                  Save a reusable widget configuration now and assign it to a template later.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPresetModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Preset name">
                  <Input
                    value={presetDraft.presetName}
                    onChange={(event) =>
                      setPresetDraft((current) => ({ ...current, presetName: event.target.value }))
                    }
                    placeholder="Critical router alarms"
                  />
                </Field>
                <p className="mt-1 text-xs text-muted">
                  This name becomes the widget heading when the preset is used.
                </p>
              </div>
              <Field label="Chart type">
                <Select
                  value={presetDraft.chartType}
                  onChange={(event) =>
                    setPresetDraft((current) => ({
                      ...current,
                      chartType: event.target.value as PresetDraft['chartType'],
                    }))
                  }
                >
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="table">Table</option>
                  <option value="heatmap">Heatmap</option>
                </Select>
              </Field>
              <Field label="Severity">
                <Select
                  value={presetDraft.severity}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, severity: event.target.value }))}
                >
                  <option value="">Any severity</option>
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="warning">Warning</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={presetDraft.status}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">Any status</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="acknowledged">Acknowledged</option>
                </Select>
              </Field>
              <Field label="Error code">
                <Input
                  value={presetDraft.errorCode}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, errorCode: event.target.value }))}
                />
              </Field>
              <Field label="Vendor">
                <Input
                  value={presetDraft.vendor}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, vendor: event.target.value }))}
                />
              </Field>
              <Field label="Device type">
                <Input
                  value={presetDraft.deviceType}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, deviceType: event.target.value }))}
                />
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  value={presetDraft.startDate}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, startDate: event.target.value }))}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={presetDraft.endDate}
                  onChange={(event) => setPresetDraft((current) => ({ ...current, endDate: event.target.value }))}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
              <Button variant="ghost" onClick={() => setPresetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSavePreset}
                disabled={creatingPreset || !presetDraft.presetName.trim()}
              >
                {creatingPreset ? 'Saving...' : presetDraft.id ? 'Save changes' : 'Add preset'}
              </Button>
            </div>
          </div>
        </div>
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
