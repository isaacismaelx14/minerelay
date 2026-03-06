"use client";

import { memo, type ChangeEventHandler } from "react";

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
    <label>
      {label}
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
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
    <label>
      {label}
      <select id={name} name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});
