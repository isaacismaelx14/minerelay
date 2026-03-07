"use client";

import { memo, type ChangeEventHandler } from "react";
import { ui } from "./styles";

export const TextInput = memo(function TextInput({
  name,
  label,
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="grid gap-[8px]">
      <span className={ui.dataLabel}>{label}</span>
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
        className="border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] read-only:opacity-80 read-only:cursor-default"
      />
    </label>
  );
});

export const SelectInput = memo(function SelectInput({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="grid gap-[8px]">
      <span className={ui.dataLabel}>{label}</span>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={ui.selectField}
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
