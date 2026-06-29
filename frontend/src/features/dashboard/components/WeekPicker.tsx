import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cn } from '../../../utils/cn';

interface WeekPickerProps {
  value: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const labelFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

function toDateInputValue(value: string) {
  return value?.slice(0, 10) || '';
}

function parseIsoDate(value: string) {
  const date = new Date(`${toDateInputValue(value)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date);
  const day = nextDate.getUTCDay() || 7;
  nextDate.setUTCDate(nextDate.getUTCDate() - day + 1);
  nextDate.setUTCHours(0, 0, 0, 0);
  return nextDate;
}

export function getWeekRangeForDateValue(value?: string) {
  return getWeekDateRange(parseIsoDate(value || ''));
}

function getWeekDateRange(date: Date) {
  const weekStart = startOfWeek(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  };
}

function sameDate(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function getMonthGrid(monthDate: Date) {
  const firstOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
  const gridStart = startOfWeek(firstOfMonth);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return date;
  });
}

function getPopoverStyle(anchor: HTMLButtonElement | null) {
  const rect = anchor?.getBoundingClientRect();
  if (!rect) return undefined;
  const width = Math.max(rect.width, 320);
  const height = 312;
  const topSpace = rect.top - 12;
  const bottomTop = rect.bottom + 8;
  const top = topSpace >= height || window.innerHeight - bottomTop < height
    ? Math.max(12, rect.top - height - 8)
    : bottomTop;
  return {
    left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
    top,
    width,
    maxHeight: Math.min(height, window.innerHeight - 24),
  };
}

function CalendarPopover({
  anchorRef,
  visibleMonth,
  selectedDate,
  mode,
  onShiftMonth,
  onSelectDay,
}: {
  anchorRef: RefObject<HTMLButtonElement>;
  visibleMonth: Date;
  selectedDate: Date;
  mode: 'day' | 'week';
  onShiftMonth: (delta: number) => void;
  onSelectDay: (day: Date) => void;
}) {
  const days = getMonthGrid(visibleMonth);
  const selectedWeekStart = startOfWeek(selectedDate);

  return (
    <div
      className="fixed z-[80] overflow-y-auto rounded-md border border-border bg-panel-light p-3 shadow-2xl"
      style={getPopoverStyle(anchorRef.current)}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-input text-muted transition hover:border-secondary hover:text-secondary"
          onClick={() => onShiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-sm font-black text-light">
          {monthFormatter.format(visibleMonth)}
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-input text-muted transition hover:border-secondary hover:text-secondary"
          onClick={() => onShiftMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-placeholder">
        {dayLabels.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
          const weekStart = startOfWeek(day);
          const selected =
            mode === 'week' ? sameDate(weekStart, selectedWeekStart) : sameDate(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={cn(
                'h-9 rounded border border-transparent font-mono text-sm font-bold transition',
                inMonth ? 'text-light' : 'text-muted/55',
                selected
                  ? 'border-secondary bg-secondary/20 text-secondary shadow-[0_0_12px_rgba(0,245,212,0.18)]'
                  : 'hover:border-secondary/50 hover:bg-secondary/10 hover:text-secondary',
              )}
              onClick={() => onSelectDay(day)}
            >
              {day.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekPicker({ value, onChange }: WeekPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)),
  );

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setVisibleMonth(new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)));
  }, [open, selectedDate]);

  const selectedWeekStart = startOfWeek(selectedDate);
  const selectedWeekEnd = new Date(selectedWeekStart);
  selectedWeekEnd.setUTCDate(selectedWeekStart.getUTCDate() + 6);
  const label = `${labelFormatter.format(selectedWeekStart)} - ${labelFormatter.format(selectedWeekEnd)}`;

  function shiftMonth(delta: number) {
    setVisibleMonth(
      (current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)),
    );
  }

  function selectDay(day: Date) {
    onChange(getWeekDateRange(day));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-md border border-secondary/45 bg-input-dark px-4 text-left font-mono text-base font-semibold text-bright shadow-input-date outline-none transition',
          'hover:border-primary/70 hover:shadow-input-date-hover focus:border-secondary focus:bg-input-focus focus:ring-2 focus:ring-secondary/25',
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <CalendarDays className="h-4 w-4 text-secondary" aria-hidden="true" />
      </button>

      {open ? (
        <CalendarPopover
          anchorRef={buttonRef}
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          mode="week"
          onShiftMonth={shiftMonth}
          onSelectDay={selectDay}
        />
      ) : null}
    </div>
  );
}

export function DatePicker({ value, onChange, placeholder = 'Select date' }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)),
  );

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setVisibleMonth(new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)));
  }, [open, selectedDate]);

  function shiftMonth(delta: number) {
    setVisibleMonth(
      (current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)),
    );
  }

  function selectDay(day: Date) {
    onChange(day.toISOString().slice(0, 10));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-md border border-secondary/45 bg-input-dark px-4 text-left font-mono text-base font-semibold text-bright shadow-input-date outline-none transition',
          'hover:border-primary/70 hover:shadow-input-date-hover focus:border-secondary focus:bg-input-focus focus:ring-2 focus:ring-secondary/25',
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn(!value && 'text-placeholder')}>
          {value ? labelFormatter.format(selectedDate) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 text-secondary" aria-hidden="true" />
      </button>

      {open ? (
        <CalendarPopover
          anchorRef={buttonRef}
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          mode="day"
          onShiftMonth={shiftMonth}
          onSelectDay={selectDay}
        />
      ) : null}
    </div>
  );
}
