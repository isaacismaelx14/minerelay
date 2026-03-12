"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type PropsWithChildren,
  type ReactElement,
} from "react";

import type { BootstrapPayload } from "@/admin/client/types";
import { AdminShell } from "@/admin/features/shell/components/admin-shell";
import { ToastProvider } from "@minerelay/ui";
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
  const router = useRouter();
  const [initialView, setInitialView] = useState<AdminView>("overview");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [, startTransition] = useTransition();
  const isOnboardingRoute = pathname === "/onboarding";

  useEffect(() => {
    setInitialView(getAdminViewForPath(pathname));
  }, [pathname]);

  // Redirect to onboarding when no server is configured yet
  useEffect(() => {
    if (
      initialBootstrap?.needsOnboarding &&
      !hasCompletedOnboarding &&
      !isOnboardingRoute
    ) {
      router.replace("/onboarding");
    }
  }, [
    hasCompletedOnboarding,
    initialBootstrap?.needsOnboarding,
    isOnboardingRoute,
    router,
  ]);

  useEffect(() => {
    const onOnboardingComplete = () => {
      setHasCompletedOnboarding(true);
      startTransition(() => {
        router.refresh();
      });
    };

    window.addEventListener("admin:onboarding-complete", onOnboardingComplete);
    return () => {
      window.removeEventListener(
        "admin:onboarding-complete",
        onOnboardingComplete,
      );
    };
  }, [router, startTransition]);

  if (isOnboardingRoute) {
    // Render without the admin shell so the wizard is full-screen
    return (
      <AdminProvider
        initialView={initialView}
        initialBootstrap={initialBootstrap}
      >
        <ToastProvider>{children}</ToastProvider>
      </AdminProvider>
    );
  }

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
