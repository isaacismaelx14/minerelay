"use client";

import { requestJson, uploadForm } from "@/admin/client/http";
import type {
  SaveSettingsPayload,
  UploadImagePayload,
} from "@/admin/client/types";
import { useAdminStore } from "@/admin/shared/store/admin-store";

export function useIdentityPageModel() {
  const store = useAdminStore();

  const saveSettings = async () => {
    const versions = store.form.supportedMinecraftVersions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const payload = await requestJson<SaveSettingsPayload>(
        "/v1/admin/settings",
        "PATCH",
        {
          supportedMinecraftVersions: versions,
          supportedPlatforms: ["fabric"],
        },
      );
      store.setForm((current) => ({
        ...current,
        supportedMinecraftVersions: (
          payload.supportedMinecraftVersions ?? []
        ).join(", "),
      }));
      store.setStatus("settings", "Settings saved.", "ok");
    } catch (error) {
      store.setStatus(
        "settings",
        (error as Error).message || "Failed to save settings.",
        "error",
      );
    }
  };

  const uploadBrandingImage = async (
    target: "logo" | "background",
    file: File | null,
  ) => {
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    store.setStatus("draft", "Uploading image...");
    try {
      const payload = await uploadForm<UploadImagePayload>(
        "/v1/admin/media/upload",
        formData,
      );
      const url = payload.url ?? "";
      store.setForm((current) => ({
        ...current,
        brandingLogoUrl: target === "logo" ? url : current.brandingLogoUrl,
        brandingBackgroundUrl:
          target === "background" ? url : current.brandingBackgroundUrl,
      }));
      store.setStatus("draft", "Image uploaded.", "ok");
    } catch (error) {
      store.setStatus(
        "draft",
        (error as Error).message || "Upload failed.",
        "error",
      );
    }
  };

  const refreshLoaders = () =>
    store.loadFabricVersions(store.form.minecraftVersion, true);

  return {
    ...store,
    saveSettings,
    refreshLoaders,
    uploadBrandingImage,
  };
}
