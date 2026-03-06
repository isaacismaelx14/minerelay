"use client";

export {
  getAdminPathForView,
  getAdminViewForPath,
  type AdminView,
} from "@/admin/shared/domain/admin-view";
export {
  AdminStoreProvider as AdminProvider,
  useAdminStore as useAdminContext,
} from "@/admin/shared/store/admin-store";
