"use client";

import type { PropsWithChildren, ReactElement } from "react";

import { useAdminStore } from "@/admin/shared/store/admin-store";

import { MainLoadingState } from "./main-loading-state";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AdminShell({ children }: PropsWithChildren): ReactElement {
  const { isBusy, view } = useAdminStore();

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <TopBar />
        <section key={view} className="view-stage" aria-live="polite">
          {isBusy.bootstrap ? <MainLoadingState /> : children}
        </section>
      </main>
    </div>
  );
}
