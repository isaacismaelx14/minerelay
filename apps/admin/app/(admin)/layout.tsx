import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminConsolePage } from "@/admin/client/admin.client";
import { readServerBootstrapResult } from "@/admin/server/bootstrap.server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { payload: initialBootstrap, isRscTransition } =
    await readServerBootstrapResult();

  if (!isRscTransition && !initialBootstrap) {
    redirect("/login");
  }

  return (
    <>
      <AdminConsolePage initialBootstrap={initialBootstrap}>
        {children}
      </AdminConsolePage>
    </>
  );
}
