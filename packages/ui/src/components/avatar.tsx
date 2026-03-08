"use client";

import type { ReactElement, ReactNode } from "react";
import { cn } from "../cn";

const sizeClasses = {
  sm: "w-9 h-9 rounded-md text-sm",
  md: "w-12 h-12 rounded-lg text-xl",
  lg: "w-14 h-14 rounded-xl text-2xl",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export interface AvatarProps {
  /** Image source URL. When absent the fallback letter is shown. */
  src?: string;
  /** Single character shown when the image is missing or fails to load. */
  fallback?: string;
  size?: AvatarSize;
  /** Optional overlay rendered in the top-right corner (e.g. a draft badge). */
  overlay?: ReactNode;
  className?: string;
}

export function Avatar({
  src,
  fallback,
  size = "md",
  overlay,
  className,
}: AvatarProps): ReactElement {
  return (
    <div className={cn("relative shrink-0 overflow-visible", className)}>
      {overlay}
      <div
        className={cn(
          "bg-black/20 flex items-center justify-center text-[var(--color-text-muted)] border border-[var(--color-line)] shrink-0 overflow-hidden",
          sizeClasses[size],
        )}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            onError={(event) => {
              const image = event.currentTarget;
              image.style.display = "none";
              const next = image.nextElementSibling;
              if (next) next.classList.remove("hidden");
            }}
          />
        ) : null}
        <span className={cn("font-bold", src ? "hidden" : "")}>{fallback}</span>
      </div>
    </div>
  );
}
