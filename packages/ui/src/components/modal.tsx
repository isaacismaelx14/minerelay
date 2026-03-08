"use client";

import { memo, useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";

export interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  cardClassName?: string;
  wide?: boolean;
  className?: string;
}

export const Modal = memo(function Modal({
  onClose,
  children,
  cardClassName,
  wide,
  className,
}: ModalProps) {
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
      className={cn(
        "fixed inset-0 w-screen h-screen bg-surface-deep-40 backdrop-blur-[4px] z-[1000] flex items-center justify-center animate-[fadeIn_0.2s_ease-out]",
        className,
      )}
      role="presentation"
    >
      <div
        ref={cardRef}
        className={cn(
          "bg-bg-card border border-line rounded-[var(--radius-lg)] flex flex-col shadow-[0_12px_40px_var(--color-shadow-xl)] animate-[scaleIn_0.2s_ease-out] relative",
          wide
            ? "w-[min(95vw,1150px)] max-h-[85vh] p-0 gap-0 overflow-hidden"
            : "min-w-[40vw] max-w-[90vw] max-h-[85vh] overflow-y-auto p-[24px] gap-[16px]",
          cardClassName,
        )}
        role="dialog"
        aria-modal="true"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;

          const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
          );
          if (!focusables || focusables.length === 0) return;

          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!first || !last) return;

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
