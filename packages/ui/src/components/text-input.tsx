"use client";

import { memo, type ChangeEventHandler } from "react";
import { cn } from "../cn";

const labelClass =
  "font-mono text-[0.75rem] text-[var(--color-text-muted)] uppercase tracking-[0.12em] font-semibold";

const inputClass =
  "border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] read-only:opacity-80 read-only:cursor-default";

export interface TextInputProps {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  className?: string;
}

export const TextInput = memo(function TextInput({
  name,
  label,
  value,
  placeholder,
  readOnly,
  onChange,
  className,
}: TextInputProps) {
  return (
    <label className={cn("grid gap-[8px]", className)}>
      <span className={labelClass}>{label}</span>
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
        className={inputClass}
      />
    </label>
  );
});
