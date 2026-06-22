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
  return (
    <input
      className={cn(
        'h-10 w-full rounded border border-line bg-panel px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-signal focus:ring-2 focus:ring-sky-100',
        'border-white/10 bg-[#0c0b14] text-[#f3edff] placeholder:text-[#777086] focus:border-[#00f5d4] focus:ring-[#00f5d4]/15',
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
