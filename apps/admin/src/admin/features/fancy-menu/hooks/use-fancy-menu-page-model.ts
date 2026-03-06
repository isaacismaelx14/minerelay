"use client";

import { uploadForm } from "@/admin/client/http";
import type { UploadBundlePayload } from "@/admin/client/types";
import { useAdminStore } from "@/admin/shared/store/admin-store";

export function useFancyMenuPageModel() {
  const store = useAdminStore();

  const uploadFancyBundle = async (file: File | null) => {
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    store.setStatus("fancy", "Uploading FancyMenu bundle...");

    try {
      const payload = await uploadForm<UploadBundlePayload>(
        "/v1/admin/fancymenu/bundle/upload",
        formData,
      );
      store.setForm((current) => ({
        ...current,
        fancyMenuMode: "custom",
        fancyMenuCustomLayoutUrl: payload.url ?? "",
        fancyMenuCustomLayoutSha256: payload.sha256 ?? "",
      }));
      store.setStatus(
        "fancy",
        `FancyMenu bundle uploaded (${String(payload.entryCount ?? 0)} entries).`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "fancy",
        (error as Error).message || "Bundle upload failed.",
        "error",
      );
    }
  };

  return {
    ...store,
    uploadFancyBundle,
    setFancyMenuMode: (mode: "simple" | "custom") =>
      store.setForm((prev) => ({ ...prev, fancyMenuMode: mode })),
    setFancyMenuEnabled: (enabled: boolean) =>
      store.setForm((prev) => ({
        ...prev,
        fancyMenuEnabled: enabled ? "true" : "false",
      })),
  };
}
