"use client";

import { memo, type ChangeEventHandler } from "react";
import { cn } from "../cn";

const labelClass =
  "font-mono text-[0.75rem] text-[var(--color-text-muted)] uppercase tracking-[0.12em] font-semibold";

const selectClass =
  "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name: string;
  label: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  className?: string;
}

export const Select = memo(function Select({
  name,
  label,
  value,
  options,
  onChange,
  className,
}: SelectProps) {
  return (
    <label className={cn("grid gap-[8px]", className)}>
      <span className={labelClass}>{label}</span>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={selectClass}
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});
