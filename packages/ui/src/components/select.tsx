"use client";

import { memo, useId, type ChangeEventHandler, type ChangeEvent } from "react";
import { Select as BaseSelect } from "@base-ui-components/react/select";
import { cn } from "../cn";

const labelClass =
  "font-mono text-[0.75rem] text-text-muted uppercase tracking-[0.12em] font-semibold";

const triggerBaseClass =
  "inline-flex w-full items-center justify-between gap-3 border border-line bg-surface-deep-30 text-left text-[0.95rem] text-text-primary transition-all duration-150 ease-out outline-none focus-visible:border-brand-primary focus-visible:bg-surface-deep-40 focus-visible:shadow-[0_0_0_4px_var(--color-brand-primary-ring)] data-[popup-open]:border-brand-primary data-[popup-open]:bg-surface-deep-40 disabled:cursor-not-allowed disabled:opacity-60";

const triggerDefaultClass = "min-h-[52px] rounded-[var(--radius-md)] px-4 py-3";

const triggerCompactClass =
  "min-h-7 rounded-[var(--radius-sm)] bg-transparent px-2 py-1 text-[0.65rem] text-text-muted";

const valueBaseClass =
  "min-w-0 flex-1 truncate data-[placeholder]:text-text-muted";

const iconBaseClass =
  "shrink-0 text-text-muted transition-transform duration-150 data-[popup-open]:rotate-180";

const popupClass =
  "z-1300 w-[min(var(--anchor-width),calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-lg)] border border-line-strong bg-[color:var(--color-bg-card)] shadow-[0_18px_48px_var(--color-shadow-xl)] backdrop-blur-xl";

const listClass =
  "max-h-[min(18rem,var(--available-height))] overflow-auto p-1";

const itemClass =
  "grid cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[0.9rem] text-text-secondary outline-none transition-colors duration-150 data-[highlighted]:bg-brand-primary-ring data-[highlighted]:text-white data-[selected]:text-white data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

const indicatorClass = "text-brand-accent";

const scrollArrowClass = "flex h-7 items-center justify-center text-text-muted";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  name: string;
  label?: string;
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  className?: string;
  variant?: "default" | "compact";
  disabled?: boolean;
}

export const Select = memo(function Select({
  name,
  label,
  value,
  options,
  onChange,
  className,
  variant = "default",
  disabled = false,
}: SelectProps) {
  const labelId = useId();

  const triggerClassName =
    variant === "compact"
      ? cn(triggerBaseClass, triggerCompactClass)
      : cn(triggerBaseClass, triggerDefaultClass);

  const iconClassName =
    variant === "compact"
      ? cn(iconBaseClass, "text-[0.7rem]")
      : cn(iconBaseClass, "text-[0.9rem]");

  const handleValueChange = (nextValue: string | null) => {
    const normalizedValue = nextValue ?? "";
    const target = {
      id: name,
      name,
      value: normalizedValue,
    } as HTMLSelectElement;

    onChange({
      target,
      currentTarget: target,
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className={cn(label ? "grid gap-2" : "block", className)}>
      {label ? (
        <span id={labelId} className={labelClass}>
          {label}
        </span>
      ) : null}
      <BaseSelect.Root
        id={name}
        name={name}
        items={options}
        value={value}
        disabled={disabled}
        modal={false}
        onValueChange={handleValueChange}
      >
        <BaseSelect.Trigger
          aria-labelledby={label ? labelId : undefined}
          className={triggerClassName}
        >
          <BaseSelect.Value className={valueBaseClass} />
          <BaseSelect.Icon className={iconClassName}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </BaseSelect.Icon>
        </BaseSelect.Trigger>

        <BaseSelect.Portal>
          <BaseSelect.Positioner
            sideOffset={8}
            alignItemWithTrigger={false}
            positionMethod="fixed"
            collisionPadding={16}
            className="z-1300 outline-none"
          >
            <BaseSelect.Popup className={popupClass}>
              <BaseSelect.ScrollUpArrow className={scrollArrowClass}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7.5L6 4.5L9 7.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </BaseSelect.ScrollUpArrow>

              <BaseSelect.List className={listClass}>
                {options.map((option) => (
                  <BaseSelect.Item
                    key={`${name}-${option.value}`}
                    value={option.value}
                    label={option.label}
                    disabled={option.disabled}
                    className={itemClass}
                  >
                    <BaseSelect.ItemText className="truncate">
                      {option.label}
                    </BaseSelect.ItemText>
                    <BaseSelect.ItemIndicator className={indicatorClass}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 6.25L4.75 8.5L9.5 3.75"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>

              <BaseSelect.ScrollDownArrow className={scrollArrowClass}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </BaseSelect.ScrollDownArrow>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
    </div>
  );
});
