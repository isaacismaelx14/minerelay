"use client";

import { useMemo, useState, type FormEvent, type ReactElement } from "react";
import { buildAdminApiUrl, readError, writeAdminSession } from "./http";
import type { AdminAuthPayload } from "./types";

type LoginStatus = {
  text: string;
  tone: "idle" | "ok" | "error";
};

function statusClass(tone: LoginStatus["tone"]): string {
  if (tone === "ok") return "status ok";
  if (tone === "error") return "status error";
  return "status";
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
    <main className="login-shell">
      <h1>MineRelay Control Console</h1>
      <p>Enter your admin password to unlock server publishing controls.</p>

      <form onSubmit={(event) => void onSubmit(event)}>
        <label>
          Password
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="Admin password"
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>

        <button id="loginBtn" type="submit" disabled={disabled}>
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
