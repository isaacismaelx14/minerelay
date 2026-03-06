"use client";

import { useAdminStore } from "@/admin/shared/store/admin-store";

export function useOverviewPageModel() {
  const store = useAdminStore();

  return {
    form: store.form,
    selectedMods: store.selectedMods,
    summaryStats: store.summaryStats,
    rail: store.rail,
    goToIdentity: () => store.setView("identity"),
    goToMods: () => store.setView("mods"),
    goToFancy: () => store.setView("fancy"),
  };
}
