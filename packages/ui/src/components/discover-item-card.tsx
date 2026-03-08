"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

export interface DiscoverItemCardProps {
  media: ReactNode;
  idLabel?: ReactNode;
  title: string;
  description?: string;
  footerLabel?: string;
  footerValue?: ReactNode;
  actionButton?: ReactNode;
  className?: string;
}

export function DiscoverItemCard({
  media,
  idLabel,
  title,
  description,
  footerLabel = "Author",
  footerValue,
  actionButton,
  className,
}: DiscoverItemCardProps): ReactElement {
  return (
    <div
      className={cn(
        "bg-bg-card border border-line rounded-xl p-5 flex flex-col gap-4 hover:border-brand-primary/50 transition-all group",
        className,
      )}
    >
      <div className="flex justify-between items-start gap-2">
        {media}
        {idLabel ? (
          <div className="flex flex-col items-end">{idLabel}</div>
        ) : null}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-lg group-hover:text-brand-primary transition-colors line-clamp-1 m-0">
          {title}
        </h4>
        {description ? (
          <p
            className="text-xs text-text-muted line-clamp-2 mt-1 m-0"
            title={description}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between mt-2 pt-4 border-t border-line gap-2">
        <div className="flex flex-col min-w-0 flex-1 mr-2">
          <span className="text-[10px] font-bold text-text-muted uppercase">
            {footerLabel}
          </span>
          <span className="text-xs font-medium truncate">{footerValue}</span>
        </div>
        {actionButton}
      </div>
    </div>
  );
}
