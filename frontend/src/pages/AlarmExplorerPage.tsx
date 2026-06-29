import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  ListFilter,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { PageShell } from '../components/shared/PageShell';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import {
  nettraceApi,
  type AlarmColumn,
  type AlarmSearchField,
  type Alarm,
  type QueryAlarmsParams,
  type SortBy,
  type SortOrder,
} from '../services/generated/nettrace-api';
import { DatePicker } from '../features/dashboard/components/WeekPicker';
import { ALARM_COLUMN_OPTIONS } from '../constants/alarmColumns';
import { cn } from '../utils/cn';

type AlarmColumnKey = AlarmColumn;

const COLUMN_OPTIONS: Array<{ key: AlarmColumnKey; label: string; sortable?: SortBy }> = [
  ...ALARM_COLUMN_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
  })),
].map((option) => ({
  ...option,
  sortable:
    option.key === 'time_created'
      ? 'timestamp'
      : option.key === 'severity' || option.key === 'status'
        ? option.key
        : undefined,
}));

const DEFAULT_COLUMNS: AlarmColumnKey[] = [
  'alarm_id',
  'severity',
  'device_name',
  'device_type',
  'error_code',
  'time_created',
  'status',
];

const ALARM_DETAIL_COLUMNS: AlarmColumn[] = ALARM_COLUMN_OPTIONS.map((option) => option.value);

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'timestamp', label: 'Created time' },
  { value: 'severity', label: 'Severity' },
  { value: 'status', label: 'Status' },
];

const SEARCH_FIELD_OPTIONS: Array<{ value: AlarmSearchField; label: string }> = [
  { value: 'alarm_id', label: 'Alarm ID' },
  { value: 'device_id', label: 'Device ID' },
  { value: 'device_name', label: 'Device name' },
  { value: 'device_type', label: 'Device type' },
  { value: 'error_code', label: 'Error code' },
  { value: 'error_name', label: 'Error name' },
  { value: 'severity', label: 'Severity' },
  { value: 'status', label: 'Status' },
  { value: 'description', label: 'Description' },
  { value: 'raw_log', label: 'Raw log' },
];

function splitCsv(value: string) {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getAlarmCellValue(alarm: Alarm, key: AlarmColumnKey) {
  if (key === 'device_name') return alarm.device_details?.name ?? alarm.device_id;
  if (key === 'error_name') return alarm.error_details?.name ?? alarm.error_code;
  if (key === 'error_domain') return alarm.error_details?.domain ?? 'N/A';
  if (key === 'error_description') return alarm.error_details?.description ?? 'N/A';
  if (key === 'error_default_severity') return alarm.error_details?.default_severity ?? 'N/A';
  if (key === 'device_type') return alarm.device_details?.device_type ?? 'N/A';
  if (key === 'vendor_id') return alarm.device_details?.vendor_id ?? 'N/A';
  if (key === 'vendor_name') return alarm.device_details?.vendor_name ?? 'N/A';
  if (key === 'vendor_country') return alarm.device_details?.vendor_country ?? 'N/A';
  if (key === 'station_id') return alarm.device_details?.station_id ?? 'N/A';
  if (key === 'station_name') return alarm.device_details?.station_name ?? 'N/A';
  if (key === 'station_province') return alarm.device_details?.station_province ?? 'N/A';
  if (key === 'ip_address') return alarm.device_details?.ip_address ?? 'N/A';
  if (key === 'longitude') return alarm.device_details?.longitude ?? 'N/A';
  if (key === 'latitude') return alarm.device_details?.latitude ?? 'N/A';
  if (key === 'time_created') return formatDateTime(alarm.time_created);
  if (key === 'time_solved') return formatDateTime(alarm.time_solved);
  return alarm[key] ?? 'N/A';
}

function isLongDetailField(key: AlarmColumnKey) {
  return key === 'raw_log' || key === 'description' || key === 'error_description';
}

function severityClass(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') {
    return 'border-danger bg-danger/12 text-danger-light shadow-glow-danger';
  }
  if (normalized === 'major') {
    return 'border-primary bg-primary/12 text-primary-light shadow-glow-primary';
  }
  if (normalized === 'warning') {
    return 'border-warning bg-warning/12 text-warning shadow-glow-warning';
  }
  if (normalized === 'minor') {
    return 'border-secondary bg-secondary/12 text-secondary shadow-glow-secondary';
  }
  return 'border-secondary/60 bg-secondary/10 text-secondary shadow-glow-secondary';
}

function MultiChoiceSelect({
  label,
  values,
  onChange,
  placeholder,
  options,
  isLoading = false,
  onSelected,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  isLoading?: boolean;
  onSelected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchable = options.length > 10;
  const visibleOptions = searchable && search.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

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
    onSelected();
  }

  return (
    <Field label={label} labelVariant="nested">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex h-10 w-full items-center justify-between gap-3 rounded border border-border bg-input px-3 text-left text-sm text-light outline-none transition hover:border-primary/60 focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/15"
        >
          <span className={cn('truncate', values.length === 0 && 'text-placeholder')}>
            {values.length > 0 ? values.join(', ') : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={cn('shrink-0 text-secondary transition', open && 'rotate-180')}
          />
        </button>
        {open ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-border bg-panel p-2 shadow-2xl">
            {searchable ? (
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search options..."
                className="mb-2 h-9 text-xs"
              />
            ) : null}
            <div className="max-h-52 overflow-y-auto">
              {isLoading ? (
                <p className="px-2 py-3 text-sm text-muted">Loading...</p>
              ) : visibleOptions.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted">No options found.</p>
              ) : (
                visibleOptions.map((option) => {
                  const selected = values.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm transition',
                        selected
                          ? 'bg-secondary/10 text-bright'
                          : 'text-muted hover:bg-white/[0.04] hover:text-bright',
                      )}
                    >
                      <span>{option.label}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded',
                          selected ? 'bg-secondary text-input-dark' : 'border border-white/20',
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
  onSelected,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  optionKey: 'deviceTypes' | 'vendors' | 'provinces';
  placeholder: string;
  onSelected: () => void;
}) {
  const optionsQuery = useQuery({
    queryKey: ['metadata-options', optionKey],
    queryFn: () => nettraceApi.getMetadataOptions(),
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
      onSelected={onSelected}
    />
  );
}

export function AlarmExplorerPage() {
  const [columns, setColumns] = useState<AlarmColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<AlarmSearchField>('alarm_id');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [station, setStation] = useState('');
  const [stationId, setStationId] = useState('');
  const [provinces, setProvinces] = useState<string[]>([]);
  const [errorCode, setErrorCode] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const filtersMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const queryParams = useMemo<QueryAlarmsParams>(
    () => ({
      from_time: fromDate || undefined,
      to_time: toDate || undefined,
      severity: severity ? [severity] : undefined,
      status: status ? [status] : undefined,
      device_id: splitCsv(deviceId),
      device_name: splitCsv(deviceName),
      device_type: deviceTypes.length > 0 ? deviceTypes : undefined,
      vendor: vendors.length > 0 ? vendors : undefined,
      station: splitCsv(station),
      station_id: splitCsv(stationId),
      province: provinces.length > 0 ? provinces : undefined,
      error_code: splitCsv(errorCode),
      offset: page * pageSize,
      limit: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
      include_total: true,
      columns: Array.from(new Set<AlarmColumn>([...columns, ...ALARM_DETAIL_COLUMNS])),
      search: search.trim() || undefined,
      search_field: search.trim() ? searchField : undefined,
    }),
    [
      deviceId,
      deviceName,
      deviceTypes,
      errorCode,
      fromDate,
      page,
      pageSize,
      search,
      searchField,
      severity,
      sortBy,
      sortOrder,
      status,
      station,
      stationId,
      toDate,
      vendors,
      provinces,
    ],
  );

  const alarmsQuery = useQuery({
    queryKey: ['alarm-explorer', queryParams],
    queryFn: () => nettraceApi.queryAlarms(queryParams),
  });

  const rows = alarmsQuery.data?.data ?? [];
  const total = Number(alarmsQuery.data?.meta?.total ?? rows.length);
  const filteredRows = rows;
  const selectedAlarm = filteredRows.find((alarm) => alarm.alarm_id === selectedAlarmId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = Boolean(
    fromDate ||
      toDate ||
      severity ||
      status ||
      deviceId ||
      deviceName ||
      deviceTypes.length > 0 ||
      vendors.length > 0 ||
      station ||
      stationId ||
      provinces.length > 0 ||
      errorCode,
  );
  const sortActive = sortBy !== 'timestamp' || sortOrder !== 'desc';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(target)) {
        setFiltersOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setSortOpen(false);
      }
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(target)) {
        setColumnsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleColumn(key: AlarmColumnKey) {
    setColumns((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function resetPaging() {
    setPage(0);
    setSelectedAlarmId(null);
  }

  function clearFilters() {
    setFromDate('');
    setToDate('');
    setSeverity('');
    setStatus('');
    setDeviceId('');
    setDeviceName('');
    setDeviceTypes([]);
    setVendors([]);
    setStation('');
    setStationId('');
    setProvinces([]);
    setErrorCode('');
    resetPaging();
  }

  async function copyRawLog() {
    if (!selectedAlarm?.raw_log) return;
    await navigator.clipboard.writeText(selectedAlarm.raw_log);
    toast.success('Raw log copied');
  }

  return (
    <PageShell>
        <PageHeader
          title="Alarm"
          accent="Explorer"
          description="Explore, search, and analyze network alarms with configurable table views."
        />

        <div className={cn('grid gap-5', selectedAlarm && 'xl:grid-cols-[minmax(0,1fr)_24rem]')}>
          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded border border-border bg-input px-3 shadow-glow-primary-soft transition focus-within:border-primary/70">
                <Search size={18} className="text-primary" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPaging();
                  }}
                  placeholder={`Search by ${
                    SEARCH_FIELD_OPTIONS.find((option) => option.value === searchField)?.label.toLowerCase() ??
                    'field'
                  }`}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-light outline-none placeholder:text-placeholder"
                />
                <span className="h-6 w-px bg-white/10" />
                <select
                  value={searchField}
                  onChange={(event) => {
                    setSearchField(event.target.value as AlarmSearchField);
                    resetPaging();
                  }}
                  className="h-8 max-w-[9rem] rounded border border-white/10 bg-panel px-2 text-xs font-semibold text-medium outline-none transition hover:border-primary/50 focus:border-secondary"
                  aria-label="Search field"
                >
                  {SEARCH_FIELD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <div ref={filtersMenuRef} className="relative">
                  <Button
                    variant="ghost"
                    className={cn(
                      filtersActive &&
                        'border border-secondary/70 bg-secondary/10 text-secondary hover:bg-secondary/15 hover:text-secondary-light',
                    )}
                    onClick={() => {
                      setFiltersOpen((value) => !value);
                      setSortOpen(false);
                      setColumnsOpen(false);
                    }}
                  >
                    <ListFilter size={16} />
                    Filter
                  </Button>
                  {filtersOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-[min(42rem,calc(100vw-3rem))] rounded-lg border border-border bg-panel p-4 shadow-2xl">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="From date" labelVariant="nested">
                          <DatePicker value={fromDate} onChange={(value) => { setFromDate(value); resetPaging(); }} placeholder="From date" />
                        </Field>
                        <Field label="To date" labelVariant="nested">
                          <DatePicker value={toDate} onChange={(value) => { setToDate(value); resetPaging(); }} placeholder="To date" />
                        </Field>
                        <Field label="Severity" labelVariant="nested">
                          <Select value={severity} onChange={(event) => { setSeverity(event.target.value); resetPaging(); }}>
                            <option value="">Any severity</option>
                            <option value="critical">Critical</option>
                            <option value="major">Major</option>
                            <option value="minor">Minor</option>
                            <option value="warning">Warning</option>
                          </Select>
                        </Field>
                        <Field label="Status" labelVariant="nested">
                          <Select value={status} onChange={(event) => { setStatus(event.target.value); resetPaging(); }}>
                            <option value="">Any status</option>
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                          </Select>
                        </Field>
                        <Field label="Device ID" labelVariant="nested">
                          <Input value={deviceId} onChange={(event) => { setDeviceId(event.target.value); resetPaging(); }} placeholder="DEV001, DEV002" />
                        </Field>
                        <Field label="Device name" labelVariant="nested">
                          <Input value={deviceName} onChange={(event) => { setDeviceName(event.target.value); resetPaging(); }} placeholder="Core switch, Access router" />
                        </Field>
                        <Field label="Error code" labelVariant="nested">
                          <Input value={errorCode} onChange={(event) => { setErrorCode(event.target.value); resetPaging(); }} placeholder="ERR_LINK_DOWN" />
                        </Field>
                        <MetadataSelect
                          label="Device type"
                          values={deviceTypes}
                          onChange={setDeviceTypes}
                          optionKey="deviceTypes"
                          placeholder="Any device type"
                          onSelected={resetPaging}
                        />
                        <MetadataSelect
                          label="Vendor"
                          values={vendors}
                          onChange={setVendors}
                          optionKey="vendors"
                          placeholder="Any vendor"
                          onSelected={resetPaging}
                        />
                        <Field label="Station" labelVariant="nested">
                          <Input value={station} onChange={(event) => { setStation(event.target.value); resetPaging(); }} placeholder="Hanoi Central, HCM Site" />
                        </Field>
                        <Field label="Station ID" labelVariant="nested">
                          <Input value={stationId} onChange={(event) => { setStationId(event.target.value); resetPaging(); }} placeholder="ST001, ST002" />
                        </Field>
                        <MetadataSelect
                          label="Province"
                          values={provinces}
                          onChange={setProvinces}
                          optionKey="provinces"
                          placeholder="Any province"
                          onSelected={resetPaging}
                        />
                        <Field label="Rows" labelVariant="nested">
                          <Select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); resetPaging(); }}>
                            <option value="10">10 rows</option>
                            <option value="25">25 rows</option>
                            <option value="50">50 rows</option>
                            <option value="100">100 rows</option>
                          </Select>
                        </Field>
                      </div>
                      <div className="mt-4 flex justify-end border-t border-white/10 pt-3">
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-xs font-semibold text-muted transition hover:text-secondary"
                        >
                          Clear filters
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div ref={sortMenuRef} className="relative">
                  <Button
                    variant="ghost"
                    className={cn(
                      sortActive &&
                        'border border-primary/70 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary-lighter',
                    )}
                    onClick={() => {
                      setSortOpen((value) => !value);
                      setFiltersOpen(false);
                      setColumnsOpen(false);
                    }}
                  >
                    <ArrowDownUp size={16} />
                    Sort
                  </Button>
                  {sortOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-panel p-4 shadow-2xl">
                      <div className="grid gap-3">
                        <Field label="Sort by" labelVariant="nested">
                          <Select
                            value={sortBy}
                            onChange={(event) => {
                              setSortBy(event.target.value as SortBy);
                              resetPaging();
                            }}
                          >
                            {SORT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Direction" labelVariant="nested">
                          <Select
                            value={sortOrder}
                            onChange={(event) => {
                              setSortOrder(event.target.value as SortOrder);
                              resetPaging();
                            }}
                          >
                            <option value="desc">Newest / highest first</option>
                            <option value="asc">Oldest / lowest first</option>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div ref={columnsMenuRef} className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setColumnsOpen((value) => !value);
                      setFiltersOpen(false);
                      setSortOpen(false);
                    }}
                  >
                    <Columns3 size={16} />
                    Fields
                  </Button>
                  {columnsOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-border bg-panel p-2 shadow-2xl">
                      <div className="mb-2 flex gap-2 border-b border-white/10 pb-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 flex-1 text-xs"
                          onClick={() => setColumns([])}
                        >
                          Deselect all
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 flex-1 text-xs"
                          onClick={() => setColumns(COLUMN_OPTIONS.map((column) => column.key))}
                        >
                          Select all
                        </Button>
                      </div>
                      {COLUMN_OPTIONS.map((column) => {
                        const checked = columns.includes(column.key);
                        return (
                          <button
                            key={column.key}
                            type="button"
                            onClick={() => toggleColumn(column.key)}
                            className={cn(
                              'flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm transition',
                              checked
                                ? 'bg-secondary/10 text-bright'
                                : 'text-muted hover:bg-white/[0.04] hover:text-bright',
                            )}
                          >
                            {column.label}
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded',
                                checked ? 'bg-secondary text-input-dark' : 'border border-white/20',
                              )}
                            >
                              {checked ? <Check size={13} strokeWidth={3} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-secondary/20 bg-panel-light/85 shadow-glow-secondary-soft">
              <div className="overflow-auto">
                <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr>
                      {columns.map((key) => {
                        const column = COLUMN_OPTIONS.find((item) => item.key === key)!;
                        return (
                          <th
                            key={key}
                            className="sticky top-0 z-10 border-b border-white/10 bg-panel-light px-4 py-3 font-mono text-xs font-semibold uppercase text-primary"
                          >
                            {column.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {alarmsQuery.isLoading ? (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                          Loading alarms...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                          No alarms found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((alarm) => {
                        const selectedForDetails = selectedAlarmId === alarm.alarm_id;
                        return (
                          <tr
                            key={alarm.alarm_id}
                            onClick={() => setSelectedAlarmId(alarm.alarm_id)}
                            className={cn(
                              'cursor-pointer transition hover:bg-white/[0.04]',
                              selectedForDetails && 'bg-primary/12',
                            )}
                          >
                            {columns.map((key) => (
                              <td
                                key={key}
                                className="max-w-[16rem] truncate border-b border-white/10 px-4 py-3 text-medium"
                              >
                                {key === 'severity' ? (
                                  <span className={cn('rounded border px-2 py-1 font-mono text-[11px] font-bold uppercase', severityClass(alarm.severity))}>
                                    {alarm.severity}
                                  </span>
                                ) : key === 'status' ? (
                                  <span className="font-semibold text-bright">{String(getAlarmCellValue(alarm, key))}</span>
                                ) : (
                                  getAlarmCellValue(alarm, key)
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-muted">
                <span>
                  Showing {total === 0 ? 0 : page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    className="rounded p-1 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>Page {page + 1} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded p-1 text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {selectedAlarm ? (
            <aside className="h-fit overflow-hidden rounded-lg border border-primary/45 bg-panel-light/90 xl:sticky xl:top-8">
              <div className="flex items-center justify-between border-b border-primary/25 px-5 py-4">
                <h2 className="text-xl font-bold text-primary">Alarm Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedAlarmId(null)}
                  className="rounded p-1 text-muted hover:bg-white/5 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-base font-black text-secondary">{selectedAlarm.alarm_id}</p>
                    <span className={cn('rounded border px-2 py-1 font-mono text-[11px] font-bold uppercase', severityClass(selectedAlarm.severity))}>
                      {selectedAlarm.severity}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {COLUMN_OPTIONS.map((column) => {
                    const value = getAlarmCellValue(selectedAlarm, column.key);
                    const valueText = value === null || value === undefined || value === '' ? 'N/A' : String(value);
                    const longField = isLongDetailField(column.key);

                    return (
                      <div key={column.key} className={cn(longField && 'col-span-2')}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="font-mono text-[11px] uppercase text-placeholder">{column.label}</p>
                          {column.key === 'raw_log' ? (
                            <button
                              type="button"
                              onClick={copyRawLog}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-secondary-light"
                            >
                              <Copy size={13} />
                              Copy
                            </button>
                          ) : null}
                        </div>
                        {longField ? (
                          <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded border border-secondary/15 bg-panel p-3 font-mono text-xs leading-5 text-secondary">
                            {valueText}
                          </pre>
                        ) : (
                          <p className="break-words font-semibold text-bright">{valueText}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
    </PageShell>
  );
}
