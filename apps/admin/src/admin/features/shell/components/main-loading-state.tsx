"use client";

import { memo } from "react";

export const MainLoadingState = memo(function MainLoadingState() {
  return (
    <div
      className="grid gap-[16px] animate-[fadeIn_0.2s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="h-[44px] rounded-[var(--radius-lg)] bg-white/5 border border-[var(--color-line)] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <div className="h-[132px] rounded-[var(--radius-lg)] bg-white/5 border border-[var(--color-line)] animate-pulse" />
        <div className="h-[132px] rounded-[var(--radius-lg)] bg-white/5 border border-[var(--color-line)] animate-pulse" />
        <div className="h-[132px] rounded-[var(--radius-lg)] bg-white/5 border border-[var(--color-line)] animate-pulse" />
        <div className="h-[132px] rounded-[var(--radius-lg)] bg-white/5 border border-[var(--color-line)] animate-pulse" />
      </div>
    </div>
  );
});
