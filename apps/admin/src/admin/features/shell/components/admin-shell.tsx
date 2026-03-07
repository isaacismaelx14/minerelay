"use client";

import type { PropsWithChildren, ReactElement } from "react";

import { useAdminStore } from "@/admin/shared/store/admin-store";

import { MainLoadingState } from "./main-loading-state";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AdminShell({ children }: PropsWithChildren): ReactElement {
  const { isBusy, view } = useAdminStore();

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] h-screen p-[32px] gap-[32px] overflow-hidden">
      <Sidebar />
      <main className="border border-[var(--color-line)] rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] backdrop-blur-[var(--blur-glass)] py-[32px] px-[40px] h-full overflow-y-auto overflow-x-hidden grid grid-rows-[auto_1fr] gap-[32px] relative [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent] [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:my-[16px] [&::-webkit-scrollbar-thumb]:bg-[var(--color-line-strong)] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-[10px]">
        <TopBar />
        <section key={view} aria-live="polite">
          {isBusy.bootstrap ? <MainLoadingState /> : children}
        </section>
      </main>
    </div>
  );
}
