"use client";

import type { ReactElement, ReactNode } from "react";

export interface ModalHeaderProps {
  title: ReactNode;
  onClose: () => void;
  subtitle?: ReactNode;
}

export function ModalHeader({
  title,
  onClose,
  subtitle,
}: ModalHeaderProps): ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)] p-[16px_20px] shrink-0">
      <div className="grid gap-1">
        <h3 className="m-0 text-lg">{title}</h3>
        {subtitle ? (
          <p className="m-0 text-xs text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <button
        className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
