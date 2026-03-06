"use client";

import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactElement } from "react";

import { AdminShell } from "@/admin/features/shell/components/admin-shell";
import { AdminProvider, getAdminViewForPath } from "./admin-context";

export function AdminConsolePage({
  children,
}: PropsWithChildren): ReactElement {
  const pathname = usePathname();

  return (
    <AdminProvider initialView={getAdminViewForPath(pathname)}>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
