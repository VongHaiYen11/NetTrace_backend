import { Check, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Custom styled checkbox that matches the NetTrace design system.
 * Uses a button element so we can fully control its appearance.
 * Teal (#00f5d4) when checked, hot-pink glow on focus.
 */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  onClick,
  'aria-label': ariaLabel,
  className,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onChange(!checked);
        }
      }}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all duration-150 outline-none',
        // unchecked
        'border border-border bg-input-dark',
        // hover
        'hover:border-secondary/60 hover:bg-secondary/8',
        // focus
        'focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:border-secondary',
        // checked / indeterminate
        (checked || indeterminate) && 'border-secondary bg-secondary shadow-glow-secondary',
        className,
      )}
    >
      {indeterminate ? (
        <Minus size={10} strokeWidth={3} className="text-input-dark" />
      ) : checked ? (
        <Check size={10} strokeWidth={3} className="text-input-dark" />
      ) : null}
    </button>
  );
}
