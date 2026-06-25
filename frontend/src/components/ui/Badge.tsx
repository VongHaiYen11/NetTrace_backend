import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type BadgeTone = 'neutral' | 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'amber';

const tones: Record<BadgeTone, string> = {
  neutral: 'border border-white/10 bg-white/10 text-medium',
  green:
    'border border-secondary/70 bg-secondary/12 text-secondary shadow-glow-secondary',
  yellow:
    'border border-warning/80 bg-warning/12 text-warning shadow-glow-warning',
  amber:
    'border border-warning/80 bg-warning/12 text-warning shadow-glow-warning',
  orange:
    'border border-orange/80 bg-orange/12 text-orange-light shadow-glow-orange',
  red:
    'border border-primary/80 bg-primary/12 text-primary-light shadow-glow-primary',
  blue:
    'border border-secondary/70 bg-secondary/12 text-secondary shadow-glow-secondary',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded px-2 text-xs font-medium capitalize',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
