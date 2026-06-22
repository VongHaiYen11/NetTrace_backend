import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold tracking-normal text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const isDateInput = props.type === 'date';

  return (
    <input
      className={cn(
        'h-10 w-full rounded border border-line bg-panel px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-signal focus:ring-2 focus:ring-sky-100',
        'border-white/10 bg-[#0c0b14] text-[#f3edff] placeholder:text-[#777086] focus:border-[#00f5d4] focus:ring-[#00f5d4]/15',
        isDateInput &&
          'h-12 rounded-md border-[#00f5d4]/45 bg-[#0b0a14] px-4 font-mono text-base font-semibold text-[#f7f3ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,245,212,0.06),0_10px_28px_rgba(0,0,0,0.22)] hover:border-[#ff2d85]/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,45,133,0.14)] focus:border-[#00f5d4] focus:bg-[#0e0d18] focus:ring-[#00f5d4]/25',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded border border-white/10 bg-[#0c0b14] px-3 text-sm text-[#f3edff] outline-none transition focus:border-[#00f5d4] focus:ring-2 focus:ring-[#00f5d4]/15',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
