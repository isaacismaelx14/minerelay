"use client";

import { memo, type ChangeEventHandler } from "react";
import { cn } from "../cn";

const labelClass =
  "font-mono text-[0.75rem] text-text-muted uppercase tracking-[0.12em] font-semibold";

const inputClass =
  "border border-line rounded-[var(--radius-md)] bg-surface-deep-30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-text-primary w-full transition-all duration-150 ease-out outline-none focus:border-brand-primary focus:bg-surface-deep-40 focus:shadow-[0_0_0_4px_var(--color-brand-primary-ring)] read-only:opacity-80 read-only:cursor-default";

export interface TextInputProps {
  name: string;
  label?: string;
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
    <label className={cn(label ? "grid gap-[8px]" : "block", className)}>
      {label ? <span className={labelClass}>{label}</span> : null}
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
