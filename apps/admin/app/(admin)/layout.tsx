import type { ReactNode } from "react";

import { AdminConsolePage } from "@/admin/client/admin.client";
import { ADMIN_STYLES } from "@/admin/ui/admin-styles";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />
      <AdminConsolePage>{children}</AdminConsolePage>
    </>
  );
}
