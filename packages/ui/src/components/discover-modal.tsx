"use client";

import type { ReactElement, ReactNode } from "react";
import { Modal } from "./modal";
import { cn } from "../cn";

export interface DiscoverModalProps {
  title: string;
  icon?: ReactNode;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  sidebar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DiscoverModal({
  title,
  icon,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange,
  onClose,
  sidebar,
  footer,
  children,
  className,
}: DiscoverModalProps): ReactElement {
  return (
    <Modal onClose={onClose} wide className={className}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4 shrink-0">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          {icon && (
            <span className="material-symbols-outlined text-[var(--color-brand-primary)]">
              {icon}
            </span>
          )}
          {title}
        </h3>
        <button
          className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer text-[1.2rem] flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-white/10 hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="p-5 border-b border-[var(--color-line)] bg-black/10 shrink-0">
        <input
          type="text"
          className={cn(
            "w-full px-4 py-3 bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-sm)] text-sm transition-all outline-none",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]",
          )}
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </div>

      {/* Content + sidebar */}
      <div
        className="flex gap-6 min-h-[50vh] max-h-[70vh]"
        style={{ flex: 1, minHeight: 0 }}
      >
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {sidebar && (
          <div className="w-80 overflow-y-auto border-l border-[var(--color-line)] p-5 bg-black/5">
            {sidebar}
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <div className="py-4 px-5 border-t border-[var(--color-line)] flex justify-between items-center shrink-0 bg-[var(--color-bg-card)]">
          {footer}
        </div>
      )}
    </Modal>
  );
}
