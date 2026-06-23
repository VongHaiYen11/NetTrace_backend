import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import {
  nettraceApi,
  type CommonFilters,
  type ExportColumn,
  type ExportRequest,
  type SortBy,
  type SortOrder,
} from '../services/generated/nettrace-api';
import { cn } from '../utils/cn';

type ExportFormat = ExportRequest['format'];

const FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
  icon: ElementType;
}> = [
  {
    value: 'csv',
    label: 'CSV',
    description: 'Simple comma-separated file for imports.',
    icon: FileText,
  },
  {
    value: 'xlsx',
    label: 'Excel',
    description: 'Spreadsheet workbook for analysts who need sortable columns.',
    icon: FileSpreadsheet,
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Structured alarm records for integrations and API handoff.',
    icon: FileJson,
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Compact review report for bounded alarm snapshots.',
    icon: FileArchive,
  },
];

const COLUMN_OPTIONS: Array<{ value: ExportColumn; label: string }> = [
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

const DEFAULT_COLUMNS: ExportColumn[] = [
  'alarm_id',
  'time_created',
  'severity',
  'status',
  'device_id',
  'error_code',
  'description',
];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'warning', label: 'Warning' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  json: 'json',
  pdf: 'pdf',
};

function splitCsv(value: string) {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function buildFilters(values: {
  fromDate: string;
  toDate: string;
  severities: string[];
  statuses: string[];
  deviceId: string;
  errorCode: string;
  deviceTypes: string[];
  vendors: string[];
  stations: string[];
  provinces: string[];
}) {
  const filters: CommonFilters = {
    from_time: values.fromDate || undefined,
    to_time: values.toDate || undefined,
    severity: values.severities.length > 0 ? values.severities : undefined,
    status: values.statuses.length > 0 ? values.statuses : undefined,
    device_id: splitCsv(values.deviceId),
    error_code: splitCsv(values.errorCode),
    device_type: values.deviceTypes.length > 0 ? values.deviceTypes : undefined,
    vendor: values.vendors.length > 0 ? values.vendors : undefined,
    station: values.stations.length > 0 ? values.stations : undefined,
    province: values.provinces.length > 0 ? values.provinces : undefined,
  };

  return filters;
}

function MultiChoiceSelect({
  label,
  values,
  onChange,
  placeholder,
  options,
  isLoading = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <Field label={label}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex h-10 w-full items-center justify-between gap-3 rounded border border-[#2b2740] bg-[#191727] px-3 text-left text-sm text-[#f3edff] outline-none transition hover:border-[#ff2d85]/60 focus-visible:border-[#00f5d4] focus-visible:ring-2 focus-visible:ring-[#00f5d4]/15"
        >
          <span className={cn('truncate', values.length === 0 && 'text-[#777086]')}>
            {values.length > 0 ? values.join(', ') : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={cn('shrink-0 text-[#00f5d4] transition', open && 'rotate-180')}
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-[#2b2740] bg-[#11101b] p-2 shadow-2xl">
            {values.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2 border-b border-white/10 p-1 pb-3">
                {values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleValue(value)}
                    className="inline-flex items-center gap-1 rounded border border-[#00f5d4]/40 bg-[#00f5d4]/10 px-2 py-1 text-xs font-semibold text-[#f3edff]"
                  >
                    {value}
                    <X size={12} />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="max-h-52 overflow-y-auto">
              {isLoading ? (
                <p className="px-2 py-3 text-sm text-[#a69db6]">Loading...</p>
              ) : options.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[#a69db6]">No options found.</p>
              ) : (
                options.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm transition',
                        selected
                          ? 'bg-[#00f5d4]/10 text-[#f7f3ff]'
                          : 'text-[#a69db6] hover:bg-white/[0.04] hover:text-[#f7f3ff]',
                      )}
                    >
                      <span>{option.label}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded transition',
                          selected ? 'bg-[#00f5d4] text-[#0c0b14]' : 'border border-white/20',
                        )}
                      >
                        {selected ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function MetadataSelect({
  label,
  values,
  onChange,
  optionKey,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  optionKey: 'deviceTypes' | 'vendors' | 'stations' | 'provinces';
  placeholder: string;
}) {
  const optionsQuery = useQuery({
    queryKey: ['metadata-options', optionKey],
    queryFn: () => nettraceApi.getMetadataOptions({ limit: 50 }),
    staleTime: 60_000,
  });
  const options = (optionsQuery.data?.data[optionKey] ?? []).map((option) => ({
    value: option,
    label: option,
  }));

  return (
    <MultiChoiceSelect
      label={label}
      values={values}
      onChange={onChange}
      placeholder={placeholder}
      options={options}
      isLoading={optionsQuery.isLoading}
    />
  );
}

export function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState('2026-06-30');
  const [severities, setSeverities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [limit, setLimit] = useState(1000);
  const [exporting, setExporting] = useState(false);
  const activeFormat = FORMAT_OPTIONS.find((item) => item.value === format) ?? FORMAT_OPTIONS[0];
  const ActiveFormatIcon = activeFormat.icon;

  function toggleColumn(column: ExportColumn) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  async function handleExport() {
    if (columns.length === 0) {
      toast.error('Choose at least one column.');
      return;
    }

    const request: ExportRequest = {
      format,
      columns,
      filters: {
        ...buildFilters({
          fromDate,
          toDate,
          severities,
          statuses,
          deviceId,
          errorCode,
          deviceTypes,
          vendors,
          stations,
          provinces,
        }),
        sort_by: sortBy,
        sort_order: sortOrder,
        limit,
      },
    };

    setExporting(true);
    try {
      const blob = await nettraceApi.exportAlarms(request);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nettrace-alarms.${FORMAT_EXTENSION[format]}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${FORMAT_OPTIONS.find((item) => item.value === format)?.label} export started`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export alarms.';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageShell>
        <PageHeader
          title="Export"
          accent="Data"
          description="Download alarm records with the format, columns, filters, and sorting you need."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FORMAT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = format === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                className={cn(
                  'rounded-lg border p-5 text-left transition',
                  active
                    ? 'border-[#00f5d4] bg-[#00f5d4]/10 shadow-[0_0_28px_rgba(0,245,212,0.12)]'
                    : 'border-white/10 bg-[#151421]/80 hover:border-[#ff2d85]/60 hover:bg-[#191727]',
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded border border-white/10 bg-[#090911] text-[#00f5d4]">
                    <Icon size={20} />
                  </span>
                  {active ? <Check size={18} className="text-[#00f5d4]" /> : null}
                </span>
                <span className="mt-5 block text-xl font-semibold text-[#f7f3ff]">
                  {option.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-[#a69db6]">
                  {option.description}
                </span>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-[#151421]/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#f7f3ff]">Columns</h2>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setColumns(DEFAULT_COLUMNS)}>
                    Default
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setColumns([])}>
                    Deselect all
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setColumns(COLUMN_OPTIONS.map((item) => item.value))}
                  >
                    Select all
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {COLUMN_OPTIONS.map((column) => {
                  const checked = columns.includes(column.value);
                  return (
                    <button
                      key={column.value}
                      type="button"
                      onClick={() => toggleColumn(column.value)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-3 rounded border px-3 py-3 text-left text-sm transition',
                        checked
                          ? 'border-[#00f5d4]/40 bg-[#00f5d4]/5 text-[#f3edff]'
                          : 'border-[#2b2740] bg-[#191727] text-[#a69db6] hover:border-[#ff2d85]/60 hover:text-[#f7f3ff]',
                      )}
                    >
                      <span>{column.label}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded transition',
                          checked ? 'bg-[#00f5d4] text-[#0c0b14]' : 'border border-white/20',
                        )}
                      >
                        {checked ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#151421]/80 p-6">
              <h2 className="text-xl font-bold text-[#f7f3ff]">Filters</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Field label="From date">
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                </Field>
                <Field label="To date">
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                </Field>
                <Field label="Limit">
                  <Input
                    type="number"
                    min={1}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MultiChoiceSelect
                  label="Severity"
                  values={severities}
                  onChange={setSeverities}
                  placeholder="Any severity"
                  options={SEVERITY_OPTIONS}
                />
                <MultiChoiceSelect
                  label="Status"
                  values={statuses}
                  onChange={setStatuses}
                  placeholder="Any status"
                  options={STATUS_OPTIONS}
                />
                <Field label="Sort by">
                  <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                    <option value="timestamp">Timestamp</option>
                    <option value="severity">Severity</option>
                    <option value="status">Status</option>
                  </Select>
                </Field>
                <Field label="Direction">
                  <Select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </Select>
                </Field>
                <Field label="Device ID" hint="Separate multiple values with commas.">
                  <Input
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="DEV001, DEV002"
                  />
                </Field>
                <Field label="Error code" hint="Separate multiple values with commas.">
                  <Input
                    value={errorCode}
                    onChange={(e) => setErrorCode(e.target.value)}
                    placeholder="ERR-LINK-DOWN"
                  />
                </Field>
                <MetadataSelect
                  label="Device type"
                  values={deviceTypes}
                  onChange={setDeviceTypes}
                  optionKey="deviceTypes"
                  placeholder="Any device type"
                />
                <MetadataSelect
                  label="Vendor"
                  values={vendors}
                  onChange={setVendors}
                  optionKey="vendors"
                  placeholder="Any vendor"
                />
                <MetadataSelect
                  label="Station"
                  values={stations}
                  onChange={setStations}
                  optionKey="stations"
                  placeholder="Any station"
                />
                <MetadataSelect
                  label="Province"
                  values={provinces}
                  onChange={setProvinces}
                  optionKey="provinces"
                  placeholder="Any province"
                />
              </div>
            </div>
          </div>

          <aside className="h-fit overflow-hidden rounded-lg border border-[#00f5d4]/45 bg-[#07070f] shadow-[0_0_0_1px_rgba(255,45,133,0.16),0_24px_70px_rgba(0,0,0,0.42),0_0_44px_rgba(0,245,212,0.1)] xl:sticky xl:top-8">
            <div className="border-b border-[#00f5d4]/25 bg-[#00f5d4]/10 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#f7f3ff]">
                    Download
                  </h2>
                  {activeFormat.description ? (
                  <p className="text-sm leading-6 text-[#c9bfd8]">{activeFormat.description}</p>
                ) : null}
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#ff2d85]/70 bg-[#ff2d85]/15 text-[#ff2d85] shadow-[0_0_24px_rgba(255,45,133,0.2)]">
                  <ActiveFormatIcon size={22} />
                </span>
              </div>
              
            </div>

            <div className="p-6">
              <div className="rounded-lg border border-white/10 bg-[#11101b]/80 px-4 py-2">
                {[
                  { label: 'Format', value: format.toUpperCase(), accent: true },
                  { label: 'Columns', value: columns.length.toString() },
                  { label: 'Sort', value: `${sortBy} / ${sortOrder}` },
                  { label: 'Limit', value: limit.toLocaleString() },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-[#7f8ca3]">{item.label}</p>
                    <p
                      className={cn(
                        'truncate text-right text-sm font-bold',
                        item.accent ? 'text-[#00f5d4]' : 'text-[#f7f3ff]',
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {format === 'pdf' ? (
                <p className="mt-5 rounded border border-[#00f5d4]/30 bg-[#00f5d4]/10 p-3 text-sm leading-6 text-[#c9bfd8]">
                  PDF is best for bounded review packets. Use CSV, Excel, or JSON for very large
                  datasets.
                </p>
              ) : null}

              <Button
                className="mt-6 h-12 w-full border-[#ff2d85] bg-[#ff2d85] text-base font-black text-white shadow-[0_0_28px_rgba(255,45,133,0.28)] hover:bg-[#e11d72]"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download size={18} />
                {exporting ? 'Preparing export' : 'Download export'}
              </Button>
            </div>
          </aside>
        </section>
    </PageShell>
  );
}
