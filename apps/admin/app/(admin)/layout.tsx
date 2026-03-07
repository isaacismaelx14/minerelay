import type { ReactNode } from "react";

import { AdminConsolePage } from "@/admin/client/admin.client";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AdminConsolePage>{children}</AdminConsolePage>
    </>
  );
}
