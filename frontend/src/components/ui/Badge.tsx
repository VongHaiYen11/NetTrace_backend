import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type BadgeTone = 'neutral' | 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'amber';

const tones: Record<BadgeTone, string> = {
  neutral: 'border border-white/10 bg-white/10 text-[#cfc7dc]',
  green:
    'border border-[#00f5d4]/70 bg-[#00f5d4]/12 text-[#00f5d4] shadow-[0_0_14px_rgba(0,245,212,0.18)]',
  yellow:
    'border border-[#f8e231]/80 bg-[#f8e231]/12 text-[#f8e231] shadow-[0_0_14px_rgba(248,226,49,0.18)]',
  amber:
    'border border-[#f8e231]/80 bg-[#f8e231]/12 text-[#f8e231] shadow-[0_0_14px_rgba(248,226,49,0.18)]',
  orange:
    'border border-[#ff8a2d]/80 bg-[#ff8a2d]/12 text-[#ff9f4a] shadow-[0_0_14px_rgba(255,138,45,0.18)]',
  red:
    'border border-[#ff2d85]/80 bg-[#ff2d85]/12 text-[#ff5a9d] shadow-[0_0_14px_rgba(255,45,133,0.2)]',
  blue:
    'border border-[#00f5d4]/70 bg-[#00f5d4]/12 text-[#00f5d4] shadow-[0_0_14px_rgba(0,245,212,0.16)]',
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
