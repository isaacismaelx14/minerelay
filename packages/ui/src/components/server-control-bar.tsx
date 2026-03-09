"use client";

import type { ReactElement } from "react";
import { cn } from "../cn";

const toneClasses = {
  online: "border-success-border bg-success-bg text-success-bright",
  offline: "border-line bg-surface-subtle text-text-muted",
  busy: "border-warning-border bg-warning-bg text-warning-bright",
  error: "border-danger-border bg-danger-bg text-danger-soft-text",
  disabled: "border-danger-border bg-danger-bg text-danger-soft-text",
  unknown: "border-line bg-surface-subtle text-text-secondary",
} as const;

const variantClasses = {
  desktop: {
    shell:
      "relative w-full max-w-full min-[1081px]:min-w-[350px] rounded-[14px] border border-line bg-surface-subtle/60 px-3 pb-2 pt-3",
    label:
      "absolute left-3 top-[-9px] bg-bg-surface px-2 text-[0.66rem] font-medium uppercase tracking-[0.08em] text-brand-accent",
    controls:
      "flex w-full min-w-0 items-center justify-start gap-2.5 rounded-full px-2 py-2",
    statusBadge:
      "inline-flex shrink-0 rounded-full border px-2 py-1 text-[0.75rem] leading-none",
    statusText:
      "min-w-0 shrink-0 truncate text-[0.72rem] leading-none text-text-muted",
    iconActions:
      "ml-auto inline-flex shrink-0 items-center gap-1.5 border-l border-line pl-2",
    iconButton:
      "inline-flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-line bg-surface-deep-20 text-[0.8rem] leading-none text-text-secondary transition-colors hover:not-disabled:border-brand-accent hover:not-disabled:text-white disabled:cursor-default disabled:opacity-50",
  },
  compact: {
    shell:
      "relative rounded-[12px] border border-dashed border-brand-indigo-border px-2 pb-2 pt-2.5",
    label:
      "absolute left-3 top-[-9px] bg-bg-surface px-2 text-[0.66rem] font-medium uppercase tracking-[0.08em] text-brand-accent",
    controls:
      "flex w-full min-w-0 items-center justify-start gap-2.5 rounded-full px-2 py-2",
    statusBadge:
      "inline-flex shrink-0 rounded-full border px-2 py-1 text-[0.75rem] leading-none",
    statusText:
      "min-w-0 shrink-0 truncate text-[0.72rem] leading-none text-text-muted",
    iconActions:
      "ml-auto inline-flex shrink-0 items-center gap-1.5 border-l border-line pl-2",
    iconButton:
      "inline-flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-line bg-surface-deep-20 text-[0.8rem] leading-none text-text-secondary transition-colors hover:not-disabled:border-brand-accent hover:not-disabled:text-white disabled:cursor-default disabled:opacity-50",
  },
} as const;

export type ServerControlTone = keyof typeof toneClasses;
export type ServerControlBarVariant = keyof typeof variantClasses;

export interface ServerControlBarProps {
  statusLabel: string;
  statusTone: ServerControlTone;
  statusText?: string;
  isActionBusy: boolean;
  canStart: boolean;
  canRestart: boolean;
  canStop: boolean;
  disableStart: boolean;
  disableRestart: boolean;
  disableStop: boolean;
  onStart: () => void;
  onRestart: () => void;
  onStop: () => void;
  label?: string;
  variant?: ServerControlBarVariant;
  className?: string;
}

export function ServerControlBar({
  statusLabel,
  statusTone,
  statusText,
  isActionBusy,
  canStart,
  canRestart,
  canStop,
  disableStart,
  disableRestart,
  disableStop,
  onStart,
  onRestart,
  onStop,
  label = "Live Server Control",
  variant = "desktop",
  className,
}: ServerControlBarProps): ReactElement {
  const classes = variantClasses[variant];
  const canRenderActions = canStart || canRestart || canStop;

  return (
    <div className={cn(classes.shell, className)}>
      <span className={classes.label}>{label}</span>
      <section className={classes.controls}>
        <span className={cn(classes.statusBadge, toneClasses[statusTone])}>
          {statusLabel}
        </span>
        {statusText ? (
          <span className={classes.statusText}>{statusText}</span>
        ) : null}

        {canRenderActions ? (
          <div className={classes.iconActions}>
            {canStart ? (
              <button
                className={classes.iconButton}
                onClick={onStart}
                disabled={isActionBusy || disableStart}
                title="Start server"
                aria-label="Start server"
              >
                ▶
              </button>
            ) : null}
            {canRestart ? (
              <button
                className={classes.iconButton}
                onClick={onRestart}
                disabled={isActionBusy || disableRestart}
                title="Restart server"
                aria-label="Restart server"
              >
                ↻
              </button>
            ) : null}
            {canStop ? (
              <button
                className={classes.iconButton}
                onClick={onStop}
                disabled={isActionBusy || disableStop}
                title="Stop server"
                aria-label="Stop server"
              >
                ■
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
