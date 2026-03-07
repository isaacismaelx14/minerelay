import { memo } from "react";
import type { ToastMessage } from "../types";

interface ToastContainerProps {
  toasts: ToastMessage[];
}

export const ToastContainer = memo(function ToastContainer({
  toasts,
}: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item ${toast.tone === "error" ? "error" : "hint"}`}
          role="status"
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
});
