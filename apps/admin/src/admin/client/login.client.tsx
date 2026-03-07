"use client";

import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import { buildAdminApiUrl, readError, writeAdminSession } from "./http";
import type { AdminAuthPayload } from "./types";

type LoginStatus = {
  text: string;
  tone: "idle" | "ok" | "error";
};

function statusClass(tone: LoginStatus["tone"]): string {
  const base =
    "rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-black/25 min-h-[42px] flex items-center justify-center py-[10px] px-[14px] text-[0.85rem] text-[var(--color-text-muted)] transition-all duration-150 ease-out";
  if (tone === "ok")
    return `${base} text-[var(--color-success)] border-[#10b981]/20 bg-[#10b981]/5`;
  if (tone === "error")
    return `${base} text-[var(--color-danger)] border-[#ef4444]/20 bg-[#ef4444]/5`;
  return base;
}

export function AdminLoginPage(): ReactElement {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>({
    text: "",
    tone: "idle",
  });
  const disabled = useMemo(() => password.trim().length === 0, [password]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    }
  };

  return (
    <main className="w-[min(420px,calc(100vw-36px))] border border-[var(--color-line-strong)] rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] backdrop-blur-[var(--blur-glass)] p-[36px] grid gap-[20px] shadow-[0_0_0_1px_rgba(99,102,241,0.08),0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] relative animate-[fadeIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
      {/* h1 is styled globally in globals.css now, but let's ensure it has the right classes if needed. Globals.css has h1 rules for gradient text, so we can leave it mostly unstyled or apply it here if we want to remove globals completely. Wait, we added h1 to globals.css. */}
      <h1>MineRelay Control Console</h1>
      <p className="m-0 text-[0.9rem] text-[var(--color-text-muted)] leading-[1.55]">
        Enter your admin password to unlock server publishing controls.
      </p>

      <form
        className="grid gap-[16px]"
        onSubmit={(event) => void onSubmit(event)}
      >
        <label className="grid gap-[8px] text-[0.85rem] font-medium text-[var(--color-text-secondary)]">
          Password
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Admin password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            className="border border-[var(--color-line)] rounded-[var(--radius-md)] bg-black/30 py-[13px] px-[16px] text-inherit text-[0.95rem] text-[var(--color-text-primary)] w-full transition-all duration-150 ease-out outline-none focus:border-[var(--color-brand-primary)] focus:bg-black/40 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
          />
        </label>

        <button
          id="loginBtn"
          type="submit"
          disabled={disabled}
          className="border-none rounded-[var(--radius-md)] py-[14px] px-[20px] text-white bg-gradient-to-br from-[#6366f1] to-[#4f46e5] focus:outline-none text-inherit text-[0.95rem] font-semibold cursor-pointer transition-all duration-150 ease-out shadow-[0_4px_16px_rgba(99,102,241,0.25)] w-full text-center tracking-[0.01em] hover:not-disabled:-translate-y-[2px] hover:not-disabled:shadow-[0_8px_24px_rgba(99,102,241,0.4)] hover:not-disabled:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Sign In
        </button>
      </form>

      {status.text !== "" && (
        <div id="loginStatus" className={statusClass(status.tone)}>
          {status.text}
        </div>
      )}
    </main>
  );
}
