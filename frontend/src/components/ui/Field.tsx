import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  labelVariant?: 'section' | 'nested';
}

export function Field({ label, children, hint, labelVariant = 'section' }: FieldProps) {
  return (
    <label className="block">
      <span
        className={cn(
          'block font-mono tracking-normal',
          labelVariant === 'section'
            ? 'mb-3 text-base font-black text-[#c9bfd8]'
            : 'mb-2 text-sm font-bold text-[#7f8ca3]',
        )}
      >
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
        'border-[#2b2740] bg-[#191727] text-[#f3edff] placeholder:text-[#777086] hover:border-[#ff2d85]/60 focus:border-[#00f5d4] focus:ring-[#00f5d4]/15',
        isDateInput &&
          'h-12 rounded-md border-[#00f5d4]/45 bg-[#0b0a14] px-4 font-mono text-base font-semibold text-[#f7f3ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,245,212,0.06),0_10px_28px_rgba(0,0,0,0.22)] hover:border-[#ff2d85]/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,45,133,0.14)] focus:border-[#00f5d4] focus:bg-[#0e0d18] focus:ring-[#00f5d4]/25',
        className,
      )}
      {...props}
    />
  );
}

type OptionElement = ReactElement<OptionHTMLAttributes<HTMLOptionElement>, 'option'>;

function isOptionElement(child: React.ReactNode): child is OptionElement {
  return isValidElement(child) && child.type === 'option';
}

function getOptionLabel(option: OptionElement) {
  const label = option.props.label ?? option.props.children;
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  return String(option.props.value ?? '');
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
function Select(
  {
    className,
    children,
    value,
    defaultValue,
    onChange,
    onBlur,
    name,
    disabled,
    required,
    ...props
  },
  forwardedRef,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => Children.toArray(children).filter(isOptionElement),
    [children],
  );
  const firstValue = options[0]?.props.value !== undefined ? String(options[0].props.value) : '';
  const controlledValue = value !== undefined ? String(value) : undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue !== undefined ? String(defaultValue) : firstValue,
  );
  const selectedValue = controlledValue ?? internalValue;
  const selectedOption = options.find((option) => String(option.props.value ?? '') === selectedValue);
  const selectedLabel = selectedOption
    ? getOptionLabel(selectedOption)
    : options[0]
      ? getOptionLabel(options[0])
      : '';

  useEffect(() => {
    if (controlledValue !== undefined) return;
    const nativeValue = nativeSelectRef.current?.value;
    if (nativeValue !== undefined && nativeValue !== internalValue) {
      setInternalValue(nativeValue);
    }
  }, [controlledValue, internalValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function chooseOption(nextValue: string) {
    if (disabled) return;
    setInternalValue(nextValue);
    setOpen(false);

    if (nativeSelectRef.current) {
      nativeSelectRef.current.value = nextValue;
    }

    onChange?.({
      target: {
        name,
        value: nextValue,
      },
      currentTarget: {
        name,
        value: nextValue,
      },
    } as ChangeEvent<HTMLSelectElement>);
  }

  function setNativeRef(node: HTMLSelectElement | null) {
    nativeSelectRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }

  const nativeValueProps =
    controlledValue !== undefined ? { value: selectedValue } : { defaultValue: selectedValue };

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <select
        ref={setNativeRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        {...nativeValueProps}
        onChange={onChange}
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        required={required}
        {...props}
      >
        {children}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onBlur={(event) => onBlur?.(event as unknown as FocusEvent<HTMLSelectElement>)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded border border-[#2b2740] bg-[#191727] px-3 text-left text-sm text-[#f3edff] outline-none transition hover:border-[#ff2d85]/60 focus-visible:border-[#00f5d4] focus-visible:ring-2 focus-visible:ring-[#00f5d4]/15 disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-[#00f5d4] transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#2b2740] bg-[#11101b] p-2 shadow-2xl">
          {options.map((option) => {
            const optionValue = String(option.props.value ?? '');
            const selected = optionValue === selectedValue;
            return (
              <button
                key={optionValue}
                type="button"
                disabled={option.props.disabled}
                onClick={() => chooseOption(optionValue)}
                className={cn(
                  'flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'bg-[#00f5d4]/10 text-[#f7f3ff]'
                    : 'text-[#a69db6] hover:bg-white/[0.04] hover:text-[#f7f3ff]',
                )}
              >
                <span>{getOptionLabel(option)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
