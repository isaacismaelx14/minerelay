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
      <div className="flex items-center justify-between border-b border-line px-5 py-4 shrink-0">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          {icon && (
            <span className="material-symbols-outlined text-brand-primary">
              {icon}
            </span>
          )}
          {title}
        </h3>
        <button
          className="bg-transparent border-none text-text-muted cursor-pointer text-[1.2rem] flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] transition-all duration-200 hover:bg-surface-subtle-hover hover:text-white"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="p-5 border-b border-line bg-surface-deep-10 shrink-0">
        <input
          type="text"
          className={cn(
            "w-full px-4 py-3 bg-bg-card border border-line rounded-[var(--radius-sm)] text-sm transition-all outline-none",
            "text-text-primary placeholder:text-text-muted",
            "focus:border-brand-primary focus:ring-1 focus:ring-brand-primary",
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
          <div className="w-80 overflow-y-auto border-l border-line p-5 bg-surface-deep-05">
            {sidebar}
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <div className="py-4 px-5 border-t border-line flex justify-between items-center shrink-0 bg-bg-card">
          {footer}
        </div>
      )}
    </Modal>
  );
}
