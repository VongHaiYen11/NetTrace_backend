import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { DashboardFilterFormValues } from '../types';
import { defaultFilterValues } from '../filter-utils';

const filterSchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  severity: z.string(),
  status: z.string(),
  deviceId: z.string(),
  errorCode: z.string(),
  province: z.string(),
  sortBy: z.enum(['timestamp', 'severity', 'status']),
  sortOrder: z.enum(['desc', 'asc']),
});

const sortOptions = [
  { value: 'timestamp:desc', label: 'Newest first' },
  { value: 'timestamp:asc', label: 'Oldest first' },
  { value: 'severity:desc', label: 'Severity high to low' },
  { value: 'severity:asc', label: 'Severity low to high' },
  { value: 'status:desc', label: 'Status Z to A' },
  { value: 'status:asc', label: 'Status A to Z' },
] as const;

interface DashboardFiltersProps {
  values: DashboardFilterFormValues;
  onApply: (values: DashboardFilterFormValues) => void;
}

export function DashboardFilters({ values, onApply }: DashboardFiltersProps) {
  const { register, handleSubmit, reset, setError, setValue, watch, formState } = useForm<DashboardFilterFormValues>({
    values,
  });
  const selectedSort = `${watch('sortBy')}:${watch('sortOrder')}`;

  function submit(nextValues: DashboardFilterFormValues) {
    const parsed = filterSchema.safeParse(nextValues);
    if (!parsed.success) {
      setError('fromDate', { message: 'Select a time range.' });
      return;
    }
    onApply(parsed.data);
  }

  function resetFilters() {
    const nextValues = defaultFilterValues();
    reset(nextValues);
    onApply(nextValues);
  }

  return (
    <Card>
      <CardContent>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={handleSubmit(submit)}>
          <div className="flex items-center gap-2 lg:col-span-12">
            <Filter size={18} className="text-muted" />
            <h2 className="text-sm font-semibold text-[#f3edff]">Alarm filters</h2>
          </div>
          <div className="rounded border border-[#2b2740] bg-[#191727] px-3 py-2 lg:col-span-12">
            <p className="font-mono text-xs text-[#a69db6]">
              Filters narrow the alarm API query. Sort only affects the alarm list/export order.
            </p>
          </div>
          <Field label="From">
            <Input type="date" {...register('fromDate')} />
          </Field>
          <Field label="To">
            <Input type="date" {...register('toDate')} />
          </Field>
          <Field label="Severity">
            <Select {...register('severity')}>
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select {...register('status')}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="archived">Closed</option>
            </Select>
          </Field>
          <Field label="Device ID" hint="Comma-separated">
            <Input placeholder="DEV001, DEV002" {...register('deviceId')} />
          </Field>
          <Field label="Error code" hint="Comma-separated">
            <Input placeholder="ERR_LINK_DOWN" {...register('errorCode')} />
          </Field>
          <Field label="Province" hint="Comma-separated">
            <Input placeholder="Hanoi" {...register('province')} />
          </Field>
          <Field label="Sort">
            <Select
              value={selectedSort}
              onChange={(event) => {
                const [sortBy, sortOrder] = event.target.value.split(':') as [
                  DashboardFilterFormValues['sortBy'],
                  DashboardFilterFormValues['sortOrder'],
                ];
                setValue('sortBy', sortBy);
                setValue('sortOrder', sortOrder);
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end gap-2 lg:col-span-2">
            <Button className="w-full" type="submit" disabled={formState.isSubmitting}>
              <Search size={16} />
              Apply
            </Button>
            <Button variant="secondary" size="icon" onClick={resetFilters}>
              <RotateCcw size={16} />
              <span className="sr-only">Reset filters</span>
            </Button>
          </div>
          {formState.errors.fromDate ? (
            <p className="text-sm text-danger lg:col-span-12">{formState.errors.fromDate.message}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
