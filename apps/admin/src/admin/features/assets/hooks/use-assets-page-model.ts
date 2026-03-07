"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  AdminResourcePack,
  AdminShaderPack,
  SearchResult,
} from "@/admin/client/types";
import { requestJson } from "@/admin/client/http";
import { mergeAssets } from "@/admin/shared/domain/mods";
import { useAdminStore } from "@/admin/shared/store/admin-store";

type AssetType = "resourcepack" | "shaderpack";

export function useAssetsPageModel() {
  const router = useRouter();
  const store = useAdminStore();
  const [modalType, setModalType] = useState<AssetType | null>(null);
  const [popular, setPopular] = useState<SearchResult[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const inFlightKeyRef = useRef<string>("");

  const loadAssets = useCallback(
    async (type: AssetType, query: string) => {
      const normalizedQuery = query.trim();
      const requestKey = `${type}:${normalizedQuery}`;
      if (inFlightKeyRef.current === requestKey) {
        return;
      }
      inFlightKeyRef.current = requestKey;

      const minecraftVersion = store.form.minecraftVersion.trim();
      if (!minecraftVersion) {
        store.setStatus("mods", "Set Minecraft version first.", "error");
        inFlightKeyRef.current = "";
        return;
      }

      setLoadingPopular(true);
      try {
        const payload = normalizedQuery
          ? await requestJson<SearchResult[]>(
              `/v1/admin/assets/search?query=${encodeURIComponent(normalizedQuery)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&type=${type}&limit=12`,
              "GET",
            )
          : await requestJson<SearchResult[]>(
              `/v1/admin/assets/popular?minecraftVersion=${encodeURIComponent(minecraftVersion)}&type=${type}&limit=12`,
              "GET",
            );
        setPopular(payload ?? []);
        const action = normalizedQuery ? "searched" : "loaded popular";
        store.setStatus(
          "mods",
          `Successfully ${action} ${type === "resourcepack" ? "resourcepacks" : "shaderpacks"}.`,
          "ok",
        );
      } catch (error) {
        setPopular([]);
        store.setStatus(
          "mods",
          (error as Error).message || "Failed to load assets.",
          "error",
        );
      } finally {
        setLoadingPopular(false);
        inFlightKeyRef.current = "";
      }
    },
    [store],
  );

  const openPopularModal = (type: AssetType) => {
    setModalType(type);
    setSearchQuery("");
    void loadAssets(type, "");
  };

  const executeSearch = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();
      if (normalizedQuery === searchQuery) {
        return;
      }
      setSearchQuery(normalizedQuery);
      if (modalType) {
        void loadAssets(modalType, normalizedQuery);
      }
    },
    [loadAssets, modalType, searchQuery],
  );

  const closePopularModal = () => {
    setModalType(null);
    setPopular([]);
    setInstallingId(null);
    setSearchQuery("");
  };

  const installFromPopular = async (projectId: string) => {
    if (!modalType) {
      return;
    }

    const minecraftVersion = store.form.minecraftVersion.trim();
    if (!minecraftVersion) {
      store.setStatus("mods", "Set Minecraft version first.", "error");
      return;
    }

    setInstallingId(projectId);
    try {
      if (modalType === "resourcepack") {
        const resolved = (await requestJson<AdminResourcePack>(
          `/v1/admin/assets/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&type=resourcepack`,
          "GET",
        )) as AdminResourcePack;
        const next = mergeAssets(store.selectedResources, [resolved]);
        store.setSelectedResources(next);
      } else {
        const resolved = (await requestJson<AdminShaderPack>(
          `/v1/admin/assets/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&type=shaderpack`,
          "GET",
        )) as AdminShaderPack;
        const next = mergeAssets(store.selectedShaders, [resolved]);
        store.setSelectedShaders(next);
      }

      store.setStatus("mods", "Asset installed.", "ok");
      closePopularModal();
    } catch (error) {
      console.error("[assets] failed to install asset from Modrinth", {
        projectId,
        minecraftVersion,
        modalType,
        error,
      });
      store.setStatus(
        "mods",
        (error as Error).message || "Failed installing asset.",
        "error",
      );
    } finally {
      setInstallingId(null);
    }
  };

  const removeResource = (projectId?: string, sha256?: string) => {
    const next = store.selectedResources.filter((entry) => {
      if (projectId && entry.projectId === projectId) return false;
      if (sha256 && entry.sha256 === sha256) return false;
      return true;
    });
    store.setSelectedResources(next);
    store.setStatus("mods", "Resourcepack removed.", "ok");
  };

  const removeShader = (projectId?: string, sha256?: string) => {
    const next = store.selectedShaders.filter((entry) => {
      if (projectId && entry.projectId === projectId) return false;
      if (sha256 && entry.sha256 === sha256) return false;
      return true;
    });
    store.setSelectedShaders(next);
    store.setStatus("mods", "Shaderpack removed.", "ok");
  };

  return {
    status: store.statuses.mods,
    selectedMods: store.selectedMods,
    selectedResources: store.selectedResources,
    selectedShaders: store.selectedShaders,
    baselineMods: store.baselineMods,
    baselineResources: store.baselineResources,
    baselineShaders: store.baselineShaders,
    openModsManager: () => router.push("/assets/mods"),
    modalType,
    popular,
    loadingPopular,
    installingId,
    searchQuery,
    executeSearch,
    openPopularModal,
    closePopularModal,
    installFromPopular,
    removeResource,
    removeShader,
  };
}
