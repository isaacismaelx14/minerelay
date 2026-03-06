"use client";

import { memo, useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const ModalShell = memo(function ModalShell({
  onClose,
  children,
  cardClassName,
}: {
  onClose: () => void;
  children: ReactNode;
  cardClassName?: string;
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
    <div className="modal-backdrop" role="presentation">
      <div
        ref={cardRef}
        className={cardClassName || "modal-card"}
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
