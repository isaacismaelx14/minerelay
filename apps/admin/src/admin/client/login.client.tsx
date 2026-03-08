"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";

import { Button, ui } from "@minerelay/ui";
import { MineRelayLogo } from "@/admin/shared/ui/minerelay-logo";

import { buildAdminApiUrl, readError, writeAdminSession } from "./http";
import type { AdminAuthPayload } from "./types";

type LoginStatus = {
  text: string;
  tone: "idle" | "ok" | "error";
};

function statusClass(tone: LoginStatus["tone"]): string {
  const base = `${ui.statusBase} text-center`;
  if (tone === "ok") return `${base} ${ui.statusOk}`;
  if (tone === "error") return `${base} ${ui.statusError}`;
  return `${base} ${ui.statusIdle}`;
}

const BG_IMAGES = ["/mcgif-1.gif", "/mcgif-2.gif", "/mcgif-3.gif"];
const CYCLE_MS = 8000;

export function AdminLoginPage(): ReactElement {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>({
    text: "",
    tone: "idle",
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorFlash, setErrorFlash] = useState(false);
  const disabled = useMemo(() => password.trim().length === 0, [password]);

  /* ---- clear error flash after 2s ---- */
  useEffect(() => {
    if (!errorFlash) return;
    const id = setTimeout(() => setErrorFlash(false), 2000);
    return () => clearTimeout(id);
  }, [errorFlash]);

  /* ---- background cycle ---- */
  useEffect(() => {
    const id = setInterval(
      () => setActiveIndex((i) => (i + 1) % BG_IMAGES.length),
      CYCLE_MS,
    );
    return () => clearInterval(id);
  }, []);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmed = password.trim();
      if (!trimmed) {
        setStatus({ text: "Enter password first.", tone: "error" });
        return;
      }

      setStatus({ text: "Signing in...", tone: "idle" });

      try {
        const response = await fetch(buildAdminApiUrl("/v1/admin/auth/login"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: trimmed }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(await readError(response, "Invalid password."));
        }

        writeAdminSession((await response.json()) as AdminAuthPayload);
        setStatus({ text: "Signed in.", tone: "ok" });
        window.location.href = "/";
      } catch (error) {
        setStatus({
          text: (error as Error).message || "Login failed.",
          tone: "error",
        });
        setErrorFlash(true);
      }
    },
    [password],
  );

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden">
      {/* ---- fullscreen GIF background carousel ---- */}
      {BG_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out"
          style={{
            opacity: activeIndex === i ? 1 : 0,
            animation:
              activeIndex === i ? "kenBurns 20s ease-in-out infinite" : "none",
          }}
        />
      ))}

      {/* dark + blur overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      {/* ---- login card ---- */}
      <main className="relative z-10 w-[min(440px,calc(100vw-40px))] rounded-[var(--radius-xl)] bg-[rgba(10,10,14,0.75)] backdrop-blur-xl border border-white/[0.08] p-10 grid gap-7 shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] animate-[slideUp_0.6s_cubic-bezier(0.34,1.56,0.64,1)]">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-4 pb-6 border-b border-white/[0.06]">
          <div className="relative">
            <div className="absolute -inset-3 rounded-2xl bg-[#51C878]/20 blur-xl" />
            <MineRelayLogo size={52} className="relative drop-shadow-lg" />
          </div>

          <div className="text-center">
            <h1 className="m-0 text-2xl font-extrabold tracking-tight bg-gradient-to-br from-white via-white to-emerald-300 text-transparent bg-clip-text">
              MineRelay
            </h1>
            <p className="m-0 text-[0.8rem] text-[var(--color-text-muted)] mt-1.5 font-medium">
              Admin Console
            </p>
          </div>
        </div>

        {/* Form */}
        <form className="grid gap-5" onSubmit={(e) => void onSubmit(e)}>
          <label className="grid gap-2">
            <span className={ui.dataLabel}>Password</span>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="Enter admin password"
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="border border-white/[0.08] rounded-[var(--radius-md)] bg-white/[0.04] py-3.5 px-4 text-[0.95rem] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 w-full transition-all duration-200 ease-out outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(81,200,120,0.1)]"
            />
          </label>

          <Button
            id="loginBtn"
            type="submit"
            size="lg"
            disabled={disabled}
            className={[
              "w-full border-transparent font-bold transition-all duration-300",
              errorFlash
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : disabled
                  ? "bg-white/10 text-white/40"
                  : "bg-[#51C878] text-[#141E17] shadow-lg shadow-emerald-500/20 hover:not-disabled:brightness-110 hover:not-disabled:shadow-emerald-500/30 hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0",
            ].join(" ")}
          >
            {errorFlash ? "Failed" : "Sign In"}
          </Button>
        </form>

        {/* Status */}
        {status.text !== "" && (
          <div id="loginStatus" className={statusClass(status.tone)}>
            {status.text}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[0.7rem] text-[var(--color-text-muted)]/60 m-0 -mt-1">
          Secure access &middot; MineRelay
        </p>
      </main>
    </div>
  );
}
