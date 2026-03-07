"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";

import type { BootstrapPayload } from "@/admin/client/types";
import { AdminShell } from "@/admin/features/shell/components/admin-shell";
import { ToastProvider } from "@/admin/shared/ui/toast";
import {
  AdminProvider,
  getAdminViewForPath,
  type AdminView,
} from "./admin-context";

export function AdminConsolePage({
  children,
  initialBootstrap,
}: PropsWithChildren<{
  initialBootstrap?: BootstrapPayload | null;
}>): ReactElement {
  const pathname = usePathname();
  const [initialView, setInitialView] = useState<AdminView>("overview");

  useEffect(() => {
    setInitialView(getAdminViewForPath(pathname));
  }, [pathname]);

  return (
    <AdminProvider
      initialView={initialView}
      initialBootstrap={initialBootstrap}
    >
      <ToastProvider>
        <AdminShell>{children}</AdminShell>
      </ToastProvider>
    </AdminProvider>
  );
}
