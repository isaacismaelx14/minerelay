"use client";

import { memo, useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const ModalShell = memo(function ModalShell({
  onClose,
  children,
  cardClassName,
  wide,
}: {
  onClose: () => void;
  children: ReactNode;
  cardClassName?: string;
  wide?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const handleClose = useEffectEvent(onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    const inputs =
      cardRef.current?.querySelectorAll<HTMLElement>("input,textarea");
    const firstInput = inputs?.[0];
    if (firstInput) {
      firstInput.focus();
    } else {
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      focusables?.[0]?.focus();
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 w-screen h-screen bg-black/40 backdrop-blur-[4px] z-[1000] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]"
      role="presentation"
    >
      <div
        ref={cardRef}
        className={`bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] flex flex-col shadow-[0_12px_40px_rgba(0,0,0,0.5)] animate-[scaleIn_0.2s_ease-out] relative ${
          wide || cardClassName?.includes("wide")
            ? "w-[min(90vw,800px)] p-0 gap-0 overflow-hidden"
            : "min-w-[40vw] max-w-[90vw] max-h-[85vh] overflow-y-auto p-[24px] gap-[16px]"
        }`}
        role="dialog"
        aria-modal="true"
        onKeyDown={(event) => {
          if (event.key !== "Tab") {
            return;
          }

          const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
          );
          if (!focusables || focusables.length === 0) {
            return;
          }

          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!first || !last) {
            return;
          }

          const current = document.activeElement as HTMLElement | null;
          if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
});
