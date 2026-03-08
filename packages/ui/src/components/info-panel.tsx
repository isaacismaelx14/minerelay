"use client";

import type { ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../cn";

export interface InfoPanelProps {
  icon: string;
  title: string;
  iconClassName?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}

export function InfoPanel({
  icon,
  title,
  iconClassName,
  actionLabel,
  onAction,
  children,
  className,
}: InfoPanelProps): ReactElement {
  return (
    <article
      className={cn(
        "group rounded-2xl border border-line bg-surface-soft p-6 flex flex-col gap-5 transition-all duration-200 hover:bg-surface-soft-hover hover:border-line-hover",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center",
              iconClassName,
            )}
          >
            <span className="material-symbols-outlined text-[18px]">
              {icon}
            </span>
          </div>
          <h3 className="m-0 text-base font-semibold text-white">{title}</h3>
        </div>
        {actionLabel && onAction ? (
          <Button variant="outline" size="xs" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </article>
  );
}
