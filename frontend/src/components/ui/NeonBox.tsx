import type { ElementType, ComponentPropsWithoutRef } from 'react';
import { cn } from '../../utils/cn';

export type NeonBoxProps<T extends ElementType> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

export function NeonBox<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: NeonBoxProps<T>) {
  const Component = as || 'div';
  return (
    <Component
      className={cn(
        'relative border border-[#2b2740] bg-[#191727] p-4',
        className
      )}
      {...props}
    >
      {/* Top-left (Cyan) */}
      <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00f5d4]" />
      {/* Top-right (Magenta) */}
      <span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#ff2d85]" />
      {/* Bottom-left (Cyan) */}
      <span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-[#00f5d4]" />
      {/* Bottom-right (Magenta) */}
      <span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#ff2d85]" />
      {children}
    </Component>
  );
}
