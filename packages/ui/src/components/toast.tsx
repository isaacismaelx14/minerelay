"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastContextValue {
  pushToast: (tone: ToastTone, text: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const Ctx = createContext<ToastContextValue>({
  pushToast: () => {},
});

export const useToast = () => useContext(Ctx);

/* ------------------------------------------------------------------ */
/*  Provider + UI                                                      */
/* ------------------------------------------------------------------ */

const AUTO_DISMISS_MS = 3500;

const toneStyles: Record<ToastTone, string> = {
  success:
    "border-l-[3px] border-l-emerald-400 text-emerald-300 bg-emerald-500/[0.08]",
  error: "border-l-[3px] border-l-red-400 text-red-300 bg-red-500/[0.08]",
  info: "border-l-[3px] border-l-sky-400 text-sky-300 bg-sky-500/[0.08]",
};

const toneIcon: Record<ToastTone, string> = {
  success: "check_circle",
  error: "error",
  info: "info",
};

export function ToastProvider({ children }: PropsWithChildren): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const pushToast = useCallback((tone: ToastTone, text: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <Ctx value={{ pushToast }}>
      {children}

      {toasts.length > 0 && (
        <div
          className="fixed bottom-6 right-6 z-[9999] grid gap-2.5 w-[min(360px,calc(100vw-48px))] pointer-events-none"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={[
                "pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-md)] border border-white/[0.06] backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-sm font-medium animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]",
                toneStyles[t.tone],
              ].join(" ")}
              role="status"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                {toneIcon[t.tone]}
              </span>
              {t.text}
            </div>
          ))}
        </div>
      )}
    </Ctx>
  );
}
