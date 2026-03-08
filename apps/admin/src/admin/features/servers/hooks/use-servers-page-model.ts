"use client";

import { requestJson } from "@/admin/client/http";
import type {
  ConnectExarotonPayload,
  ExarotonSelectPayload,
  ExarotonServersPayload,
  ExarotonSettingsUpdatePayload,
  ExarotonStatusPayload,
  ExarotonSyncModsPayload,
} from "@/admin/client/types";
import { useAdminStore } from "@/admin/shared/store/admin-store";
import { executeExarotonServerAction } from "./exaroton-actions";

export function useServersPageModel() {
  const store = useAdminStore();

  const refreshExarotonStatus = async () => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Refreshing Exaroton status...");
    try {
      const payload = await requestJson<ExarotonStatusPayload>(
        "/v1/admin/exaroton/status",
        "GET",
      );
      store.setExaroton((current) => ({
        ...current,
        configured: payload.configured,
        connected: payload.connected,
        accountName: payload.account?.name ?? "",
        accountEmail: payload.account?.email ?? "",
        selectedServer: payload.selectedServer,
        settings: payload.settings ?? current.settings,
        busy: false,
        error: payload.error ?? "",
      }));
      store.setStatus("exaroton", "Exaroton status updated.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Could not refresh Exaroton status.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Could not refresh Exaroton status.",
        "error",
      );
    }
  };

  const listExarotonServers = async () => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Loading Exaroton servers...");
    try {
      const payload = await requestJson<ExarotonServersPayload>(
        "/v1/admin/exaroton/servers",
        "GET",
      );
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        servers: payload.servers ?? [],
      }));
      store.setStatus("exaroton", "Server list updated.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Could not load Exaroton servers.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Could not load Exaroton servers.",
        "error",
      );
    }
  };

  const connectExaroton = async () => {
    if (store.exaroton.connected) {
      store.setStatus(
        "exaroton",
        "An account is already connected. Disconnect it first.",
        "error",
      );
      return;
    }

    const apiKey = store.exaroton.apiKeyInput.trim();
    if (!apiKey) {
      store.setStatus(
        "exaroton",
        "Enter your Exaroton API key first.",
        "error",
      );
      return;
    }

    store.setExaroton((current) => ({ ...current, busy: true, error: "" }));
    store.setStatus("exaroton", "Validating API key with Exaroton...");
    try {
      const payload = await requestJson<ConnectExarotonPayload>(
        "/v1/admin/exaroton/connect",
        "POST",
        { apiKey },
      );
      store.setExaroton((current) => ({
        ...current,
        configured: payload.configured,
        connected: payload.connected,
        accountName: payload.account?.name ?? "",
        accountEmail: payload.account?.email ?? "",
        apiKeyInput: "",
        showApiKey: false,
        servers: payload.servers ?? [],
        selectedServer: payload.selectedServer ?? null,
        settings: payload.settings ?? current.settings,
        busy: false,
        error: "",
        connectionStep: "servers",
      }));
      store.setStatus("exaroton", "Exaroton account connected.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error:
          (error as Error).message || "Failed to connect Exaroton account.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Failed to connect Exaroton account.",
        "error",
      );
    }
  };

  const disconnectExaroton = async () => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Disconnecting Exaroton account...");
    try {
      await requestJson<{ success: boolean }>(
        "/v1/admin/exaroton/disconnect",
        "DELETE",
      );
      store.setExaroton((current) => ({
        ...current,
        connected: false,
        accountName: "",
        accountEmail: "",
        servers: [],
        selectedServer: null,
        busy: false,
        error: "",
        connectionStep: "idle",
      }));
      store.setStatus("exaroton", "Exaroton account disconnected.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error:
          (error as Error).message || "Failed to disconnect Exaroton account.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Failed to disconnect Exaroton account.",
        "error",
      );
    }
  };

  const selectExarotonServer = async (serverId: string) => {
    const cleanServerId = serverId.trim();
    if (!cleanServerId) {
      return;
    }
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Selecting Exaroton server...");
    try {
      const payload = await requestJson<ExarotonSelectPayload>(
        "/v1/admin/exaroton/server/select",
        "POST",
        { serverId: cleanServerId },
      );
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        selectedServer: payload.selectedServer,
        connectionStep: current.selectedServer ? "idle" : "success",
      }));
      store.setStatus("exaroton", "Server selected.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Failed to select server.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Failed to select server.",
        "error",
      );
    }
  };

  const exarotonAction = async (action: "start" | "stop" | "restart") => {
    await executeExarotonServerAction(
      action,
      store.setExaroton,
      store.setStatus,
    );
  };

  const updateExarotonSettings = async (payload: {
    modsSyncEnabled?: boolean;
    playerCanViewStatus?: boolean;
    playerCanViewOnlinePlayers?: boolean;
    playerCanStartServer?: boolean;
    playerCanStopServer?: boolean;
    playerCanRestartServer?: boolean;
  }) => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Saving Exaroton settings...");
    try {
      const response = await requestJson<ExarotonSettingsUpdatePayload>(
        "/v1/admin/exaroton/settings",
        "PATCH",
        payload,
      );
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        settings: response.settings,
      }));
      store.setStatus("exaroton", "Exaroton settings saved.", "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Failed to save Exaroton settings.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Failed to save Exaroton settings.",
        "error",
      );
    }
  };

  const syncExarotonMods = async () => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", "Running Exaroton mods sync...");
    try {
      const response = await requestJson<ExarotonSyncModsPayload>(
        "/v1/admin/exaroton/mods/sync",
        "POST",
      );
      store.setExaroton((current) => ({ ...current, busy: false }));
      store.setStatus(
        "exaroton",
        response.success
          ? `Exaroton mods synced (+${response.summary.add} / -${response.summary.remove} / =${response.summary.keep}).`
          : response.message,
        response.success ? "ok" : "error",
      );
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || "Exaroton mods sync failed.",
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || "Exaroton mods sync failed.",
        "error",
      );
    }
  };

  return {
    exaroton: store.exaroton,
    statuses: store.statuses,
    refreshExarotonStatus,
    listExarotonServers,
    connectExaroton,
    disconnectExaroton,
    selectExarotonServer,
    exarotonAction,
    updateExarotonSettings,
    syncExarotonMods,
    setExarotonStep: (step: "idle" | "key" | "servers" | "success") =>
      store.setExaroton((prev) => ({ ...prev, connectionStep: step })),
    setExarotonApiKey: (value: string) =>
      store.setExaroton((prev) => ({ ...prev, apiKeyInput: value })),
  };
}
