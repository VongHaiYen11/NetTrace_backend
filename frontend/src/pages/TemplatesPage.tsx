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
import { nettraceApi, type PresetSummary, type TemplateSummary } from '../services/generated/nettrace-api';
import { StateBlock } from '../components/shared/StateBlock';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { NeonBox } from '../components/ui/NeonBox';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  type DashboardWidgetConfig,
  TemplateEditorModal,
} from '../features/dashboard/components/GeneralSettingsDrawer';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateSort = 'date' | 'name' | 'widgets';
type TemplateSortDir = 'asc' | 'desc';
type TemplateWidgetFilter = 'all' | 'with-widgets' | 'empty';

type PresetSortKey = 'chart_type' | 'severity' | 'status' | 'vendor' | 'device_type';
type PresetSortDir = 'asc' | 'desc';

interface PresetFilter {
  chart_type: string;
  severity: string;
  status: string;
}

type TemplateModalState =
  | { mode: 'create'; widgets: DashboardWidgetConfig[] }
  | { mode: 'edit'; templateId: number; templateName: string; widgets: DashboardWidgetConfig[] };

function createTemplateDraftWidgets(): DashboardWidgetConfig[] {
  return [
    {
      id: 'kpi-total',
      type: 'kpi-total',
      title: 'Total alarms',
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
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'kpi-active',
      type: 'kpi-active',
      title: 'Active alarms',
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
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-trend',
      type: 'chart-trend',
      title: 'Daily alarms',
      layoutOrder: 1,
      layoutSpan: 2,
      visible: true,
      chartType: 'line',
      metric: 'count',
      groupBy: 'none',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
    {
      id: 'chart-severity',
      type: 'chart-severity',
      title: 'Severity split',
      layoutOrder: 2,
      layoutSpan: 1,
      visible: true,
      chartType: 'pie',
      metric: 'count',
      groupBy: 'severity',
      timeBucket: 'day',
      heatmapMode: 'weekday',
      info1: true,
      info2: true,
      info3: true,
      preset: 'Active Connections',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    },
  ];
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
            : 'text-[#a69db6] hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <Icon size={14} style={{ color: highlighted ? accentColor : undefined }} />
        {label}
        {badge ? (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black text-[#0c0b14]"
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
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg bg-[#151421]/95 p-4 shadow-xl backdrop-blur-xl">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="px-2 text-[15px] font-semibold text-[#f3edff]">{label}</p>
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
          : 'text-[#a69db6] hover:bg-white/[0.04] hover:text-white'
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
                    : 'text-[#777086] hover:text-white'
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
        active ? 'bg-white/[0.07] text-white' : 'text-[#a69db6] hover:bg-white/[0.04] hover:text-white'
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
      <span className="px-2 text-xs font-medium text-[#a69db6]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-white/10 bg-[#0c0b14] px-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:ring-2"
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
        className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] py-2 pl-10 pr-4 font-mono text-xs text-white outline-none transition-all placeholder:text-[#777086] hover:border-white/20 focus:ring-2 sm:w-56"
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
  onChange,
}: {
  value: TemplateWidgetFilter;
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
          <FilterChip label="All" active={value === 'all'} accentColor={accentColor} onClick={() => onChange('all')} />
          <FilterChip label="Has widgets" active={value === 'with-widgets'} accentColor={accentColor} onClick={() => onChange('with-widgets')} />
          <FilterChip label="Empty" active={value === 'empty'} accentColor={accentColor} onClick={() => onChange('empty')} />
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
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm text-[#a69db6] transition-colors hover:bg-white/[0.04] hover:text-white"
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
  return <p className="mb-6 max-w-3xl text-sm leading-6 text-[#a69db6]">{description}</p>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const queryClient = useQueryClient();

  // ── Templates data ──────────────────────────────────────────────────────────
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => nettraceApi.listTemplates({ limit: 50, offset: 0 }),
  });

  // ── Presets: aggregate from all templates that have widgets ─────────────────
  const templateList = templates.data?.data ?? [];

  // Fetch detail for templates that have widgets so we get real preset data
  const templateIdsWithWidgets = useMemo(
    () => templateList.filter((t) => t.number_of_widgets > 0).map((t) => t.template_id),
    [templateList],
  );

  // We'll do a single query per template-with-widgets and combine
  const presetQueries = useQuery({
    queryKey: ['template-presets', templateIdsWithWidgets],
    enabled: templateIdsWithWidgets.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        templateIdsWithWidgets.map((id) => nettraceApi.getTemplateDetail(id)),
      );
      // Flatten and deduplicate presets by preset_id
      const seen = new Set<number>();
      const presets: (PresetSummary & { templateName: string })[] = [];
      for (const res of results) {
        const templateName = res.data.name;
        for (const widget of res.data.widgets) {
          if (!seen.has(widget.preset.preset_id)) {
            seen.add(widget.preset.preset_id);
            presets.push({ ...widget.preset, templateName });
          }
        }
      }
      return presets;
    },
  });

  const allPresets = presetQueries.data ?? [];

  // ── Template local states ───────────────────────────────────────────────────
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateSort, setTemplateSort] = useState<TemplateSort>('date');
  const [templateSortDir, setTemplateSortDir] = useState<TemplateSortDir>('desc');
  const [templateWidgetFilter, setTemplateWidgetFilter] = useState<TemplateWidgetFilter>('all');
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: number; name: string } | null>(null);

  // ── Preset local states ─────────────────────────────────────────────────────
  const [presetSearch, setPresetSearch] = useState('');
  const [presetSortKey, setPresetSortKey] = useState<PresetSortKey>('chart_type');
  const [presetSortDir, setPresetSortDir] = useState<PresetSortDir>('asc');
  const [presetFilter, setPresetFilter] = useState<PresetFilter>({
    chart_type: '',
    severity: '',
    status: '',
  });

  // ── Filter / sort templates ─────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    if (!templates.data?.data) return [];
    return templates.data.data
      .filter((t) => {
        const widgetCount = t.number_of_widgets || 0;
        if (!t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false;
        if (templateWidgetFilter === 'with-widgets') return widgetCount > 0;
        if (templateWidgetFilter === 'empty') return widgetCount === 0;
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
        const searchStr = `${p.chart_type} ${p.severity ?? ''} ${p.status ?? ''} ${p.vendor ?? ''} ${p.device_type ?? ''}`.toLowerCase();
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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await nettraceApi.deleteTemplate(templateToDelete.id);
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

  const handleTemplateSaved = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['templates'] }),
      queryClient.invalidateQueries({ queryKey: ['template-presets'] }),
    ]);
    setTemplateModal(null);
  };

  const presetIsLoading = templateIdsWithWidgets.length > 0 && presetQueries.isLoading;
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
          <h2 className="text-[#ff2d85] font-headline font-bold tracking-widest text-xl uppercase drop-shadow-[0_0_8px_rgba(255,45,133,0.8)]">
            Templates
          </h2>
          <Toolbar>
            <TemplateFilterMenu value={templateWidgetFilter} onChange={setTemplateWidgetFilter} />
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
              className="group relative flex flex-col items-center justify-center h-72 border-2 border-dashed border-[#ff2d85]/30 rounded-xl bg-[#151421]/30 hover:bg-[#ff2d85]/5 hover:border-[#ff2d85] transition-all duration-300 shadow-[inset_0_0_12px_rgba(255,45,133,0.05)]"
            >
              <div className="w-14 h-14 rounded-full border border-[#ff2d85] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_12px_rgba(255,45,133,0.2)] bg-[#ff2d85]/5">
                <Plus className="text-[#ff2d85]" size={32} />
              </div>
              <span className="font-heading font-bold text-white text-base">New Template</span>
            </button>

            {/* Render List */}
            {filteredTemplates.map((template) => {
              const widgetCount = template.number_of_widgets || 0;
              const hasWidgets = widgetCount > 0;
              const formattedDate = formatDistanceToNow(parseISO(template.time_updated), {
                addSuffix: true,
                locale: enUS,
              });

              let selectedCardsLabel = 'Dashboard layout configuration node.';
              if (template.selected_cards) {
                try {
                  const parsed = JSON.parse(template.selected_cards);
                  if (typeof parsed === 'object' && parsed !== null && 'widgets' in parsed) {
                    selectedCardsLabel = `Saved snapshot · ${(parsed as { widgets?: unknown[] }).widgets?.length ?? 0} widgets`;
                  } else if (Array.isArray(parsed)) {
                    selectedCardsLabel = parsed.join(', ');
                  } else {
                    selectedCardsLabel = String(parsed);
                  }
                } catch {
                  selectedCardsLabel = template.selected_cards;
                }
              }

              return (
                <div
                  key={template.template_id}
                  onClick={() => openEditTemplateFlow(template)}
                  className="group relative flex h-72 cursor-pointer flex-col overflow-hidden rounded-lg border border-[#ff2d85]/30 bg-[#151421] transition-all duration-300 hover:border-[#00f5d4]/50 hover:shadow-[0_0_15px_rgba(0,245,212,0.1)]"
                >
                  {/* Thumbnail Area */}
                  <div className="relative h-32 w-full overflow-hidden border-b border-[#2b2740]/70 bg-[#1c1a2e]/70">
                    <div className="absolute inset-4 flex flex-col gap-2 rounded border border-[#00f5d4]/20 p-2">
                      <div className="h-3 w-1/3 rounded bg-[#00f5d4]/10" />
                      <div className="flex flex-1 gap-2">
                        <div className="flex-1 rounded border border-[#ff2d85]/20 bg-[#ff2d85]/5" />
                        <div className="w-1/3 rounded border border-[#00f5d4]/20 bg-[#00f5d4]/5" />
                      </div>
                    </div>
                    <span
                      className={`absolute right-2 top-2 rounded border px-2 py-1 text-[10px] font-bold ${
                        hasWidgets
                          ? 'border-[#ffe04a]/30 bg-[#151421] text-[#ffe04a]'
                          : 'border-white/15 bg-[#151421] text-[#a69db6]'
                      }`}
                    >
                      {hasWidgets ? 'PROD' : 'DRAFT'}
                    </span>
                  </div>

                  {/* Content Area */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="truncate pr-2 font-heading font-bold text-white transition-colors group-hover:text-[#00f5d4]">
                        {template.name}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateToDelete({ id: template.template_id, name: template.name });
                        }}
                        className="shrink-0 text-[#a69db6] opacity-0 transition-colors hover:text-[#ff2d85] group-hover:opacity-100"
                        title="Delete template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="mb-4 line-clamp-2 flex-1 text-sm text-[#a69db6]">
                      {selectedCardsLabel}
                    </p>

                    {/* Footer */}
                    <div className="mt-auto flex items-end justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded border border-white/10 bg-[#0c0b14]/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a69db6]">
                          {widgetCount} Widgets
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            hasWidgets
                              ? 'border-[#00f5d4]/30 bg-[#0c0b14]/60 text-[#00f5d4]'
                              : 'border-[#ff2d85]/30 bg-[#0c0b14]/60 text-[#ff2d85]'
                          }`}
                        >
                          {hasWidgets ? 'Active' : 'Draft'}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-[#a69db6]/50">
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
          <h2 className="text-[#ff2d85] font-headline font-bold tracking-widest text-xl uppercase drop-shadow-[0_0_8px_rgba(255,45,133,0.8)]">
            Presets
          </h2>
          <Toolbar>
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
          <div className="overflow-hidden border border-[#2b2740] rounded-xl bg-[#151421]/60 backdrop-blur-sm shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1c1a2e]/60 border-b border-[#2b2740]">
                    <th
                      className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold cursor-pointer hover:text-white transition-colors"
                      onClick={() => {
                        if (presetSortKey === 'chart_type') setPresetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else { setPresetSortKey('chart_type'); setPresetSortDir('asc'); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Chart Type
                        <ArrowUpDown size={10} className={presetSortKey === 'chart_type' ? 'text-[#00f5d4]' : 'text-[#a69db6]/40'} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold cursor-pointer hover:text-white transition-colors"
                      onClick={() => {
                        if (presetSortKey === 'severity') setPresetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else { setPresetSortKey('severity'); setPresetSortDir('asc'); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Severity
                        <ArrowUpDown size={10} className={presetSortKey === 'severity' ? 'text-[#00f5d4]' : 'text-[#a69db6]/40'} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold cursor-pointer hover:text-white transition-colors"
                      onClick={() => {
                        if (presetSortKey === 'status') setPresetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else { setPresetSortKey('status'); setPresetSortDir('asc'); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Status
                        <ArrowUpDown size={10} className={presetSortKey === 'status' ? 'text-[#00f5d4]' : 'text-[#a69db6]/40'} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold cursor-pointer hover:text-white transition-colors"
                      onClick={() => {
                        if (presetSortKey === 'vendor') setPresetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else { setPresetSortKey('vendor'); setPresetSortDir('asc'); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Vendor
                        <ArrowUpDown size={10} className={presetSortKey === 'vendor' ? 'text-[#00f5d4]' : 'text-[#a69db6]/40'} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold cursor-pointer hover:text-white transition-colors"
                      onClick={() => {
                        if (presetSortKey === 'device_type') setPresetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else { setPresetSortKey('device_type'); setPresetSortDir('asc'); }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        Device
                        <ArrowUpDown size={10} className={presetSortKey === 'device_type' ? 'text-[#00f5d4]' : 'text-[#a69db6]/40'} />
                      </div>
                    </th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a69db6] font-bold">
                      Template
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b2740]/40">
                  {filteredPresets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#a69db6]">
                        {allPresets.length === 0
                          ? templateIdsWithWidgets.length === 0
                            ? 'No templates have widgets yet. Create a template and add widgets to see presets here.'
                            : 'Loading preset data from templates...'
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
                        <tr key={preset.preset_id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#00f5d4]">
                              {preset.chart_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {preset.severity ? (
                              <Badge tone={severityTone as 'red' | 'orange' | 'green' | 'yellow' | 'blue'}>{preset.severity}</Badge>
                            ) : (
                              <span className="text-[#777086] text-xs font-mono">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {preset.status ? (
                              <Badge tone={preset.status === 'active' ? 'green' : 'neutral'}>{preset.status}</Badge>
                            ) : (
                              <span className="text-[#777086] text-xs font-mono">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[#a69db6]">
                            {preset.vendor ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[#a69db6]">
                            {preset.device_type ?? '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono text-[#a69db6]/60 italic">
                              {(preset as PresetSummary & { templateName: string }).templateName}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07070f]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm">
            <NeonBox className="p-6 rounded-lg bg-[#151421] shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-heading font-bold text-[#ff2d85] drop-shadow-[0_0_8px_rgba(255,45,133,0.4)]">
                  Delete Template
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setTemplateToDelete(null)} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
              <p className="text-sm text-[#a69db6] mb-6">
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
