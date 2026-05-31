import React from "react";

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Segment<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 shadow-sm ring-1 ring-outline-variant/30"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            value === option.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-variant/50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
