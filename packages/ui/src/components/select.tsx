"use client";

import { memo, type ChangeEventHandler } from "react";
import { cn } from "../cn";

const labelClass =
  "font-mono text-[0.75rem] text-[var(--color-text-muted)] uppercase tracking-[0.12em] font-semibold";

const selectClass =
  "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name: string;
  label?: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  className?: string;
  variant?: "default" | "compact";
}

export const Select = memo(function Select({
  name,
  label,
  value,
  options,
  onChange,
  className,
  variant = "default",
}: SelectProps) {
  const selectStyles =
    variant === "compact"
      ? "bg-transparent border border-[var(--color-line)] rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[0.65rem] text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand-primary)] cursor-pointer w-full transition-all duration-150 ease-out"
      : selectClass;

  return (
    <label className={cn(label ? "grid gap-[8px]" : "block", className)}>
      {label && <span className={labelClass}>{label}</span>}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={selectStyles}
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
