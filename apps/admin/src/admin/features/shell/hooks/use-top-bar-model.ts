"use client";

import { buildEventSourceUrl, requestJson } from "@/admin/client/http";
import type {
  ExarotonActionPayload,
  PublishPayload,
  PublishProgressPayload,
  PublishStartPayload,
  SaveDraftPayload,
} from "@/admin/client/types";
import {
  buildPublishSnapshot,
  collectBrandingPayload,
  collectFancyMenuPayload,
  isValidUrl,
} from "@/admin/shared/domain/admin-form";
import { useAdminStore } from "@/admin/shared/store/admin-store";

export function useTopBarModel() {
  const store = useAdminStore();

  const validateFormFields = (): boolean => {
    let validationError = "";
    let targetView: "identity" | "fancy" = "identity";
    let targetElement = "";

    const branding = collectBrandingPayload(store.form);
    const fancy = collectFancyMenuPayload(store.form);

    if (!store.form.serverName.trim()) {
      validationError = "Server Name is required.";
      targetElement = "serverName";
    } else if (!store.form.serverAddress.trim()) {
      validationError = "Server Address is required.";
      targetElement = "serverAddress";
    } else if (branding.logoUrl && !isValidUrl(branding.logoUrl)) {
      validationError = "Invalid Server Logo URL.";
      targetElement = "brandingLogoUrl";
    } else if (branding.backgroundUrl && !isValidUrl(branding.backgroundUrl)) {
      validationError = "Invalid Background Wallpaper URL.";
      targetElement = "brandingBackgroundUrl";
    } else if (branding.newsUrl && !isValidUrl(branding.newsUrl)) {
      validationError = "Invalid Server News Feed URL.";
      targetElement = "brandingNewsUrl";
    } else if (fancy.customLayoutUrl && !isValidUrl(fancy.customLayoutUrl)) {
      validationError = "Invalid Custom Layout URL.";
      targetView = "fancy";
      targetElement = "fancyMenuCustomLayoutUrl";
    } else if (
      fancy.customLayoutSha256 &&
      !/^[A-Fa-f0-9]{64}$/.test(fancy.customLayoutSha256)
    ) {
      validationError = "Invalid SHA256 Hash for Custom Layout.";
      targetView = "fancy";
      targetElement = "fancyMenuCustomLayoutSha256";
    }

    if (!validationError) {
      return true;
    }

    store.setStatus("draft", `Validation failed: ${validationError}`, "error");
    store.setStatus(
      "publish",
      `Validation failed: ${validationError}`,
      "error",
    );
    store.setView(targetView);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${targetElement}"]`,
      );
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return false;
  };

  const saveDraft = async () => {
    if (!validateFormFields()) return;
    store.setStatus("draft", "Saving draft...");
    try {
      const payload = await requestJson<SaveDraftPayload>(
        "/v1/admin/draft",
        "PATCH",
        {
          profileId: store.form.profileId.trim() || undefined,
          serverName: store.form.serverName.trim(),
          serverAddress: store.form.serverAddress.trim(),
          minecraftVersion: store.form.minecraftVersion.trim() || undefined,
          loaderVersion: store.form.loaderVersion.trim() || undefined,
          mods: store.selectedMods,
          fancyMenu: collectFancyMenuPayload(store.form),
          branding: collectBrandingPayload(store.form),
        },
      );

      store.setForm((current) => ({
        ...current,
        serverName: payload.server?.name ?? current.serverName,
        serverAddress: payload.server?.address ?? current.serverAddress,
        profileId: payload.server?.profileId ?? current.profileId,
        currentReleaseVersion:
          payload.releaseVersion ?? current.currentReleaseVersion,
      }));
      store.setHasSavedDraft(true);
      store.setStatus("draft", "Draft saved.", "ok");
    } catch (error) {
      store.setStatus(
        "draft",
        (error as Error).message || "Failed to save draft.",
        "error",
      );
    }
  };

  const exarotonAction = async (action: "start" | "stop" | "restart") => {
    store.setExaroton((current) => ({ ...current, busy: true }));
    store.setStatus("exaroton", `Sending ${action} action...`);
    try {
      const payload = await requestJson<ExarotonActionPayload>(
        "/v1/admin/exaroton/server/action",
        "POST",
        { action },
      );
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        selectedServer: payload.selectedServer,
      }));
      store.setStatus("exaroton", `Server ${action} action sent.`, "ok");
    } catch (error) {
      store.setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || `Failed to ${action} server.`,
      }));
      store.setStatus(
        "exaroton",
        (error as Error).message || `Failed to ${action} server.`,
        "error",
      );
    }
  };

  const publishProfile = async () => {
    if (!validateFormFields()) return;
    if (store.publishBlockReason) {
      store.setStatus("publish", store.publishBlockReason, "error");
      return;
    }

    const minecraftVersion = store.form.minecraftVersion.trim();
    const loaderVersion = store.form.loaderVersion.trim();
    if (!minecraftVersion || !loaderVersion) {
      store.setStatus(
        "publish",
        "Select Minecraft and Fabric versions first.",
        "error",
      );
      return;
    }
    if (!store.selectedMods.length) {
      store.setStatus(
        "publish",
        "Install at least one mod before publishing.",
        "error",
      );
      return;
    }

    store.setBusy("publish", true);
    store.setStatus("publish", "Publishing next release...");

    try {
      const synced = await store.ensureCoreMods(
        store.selectedMods,
        store.form.fancyMenuEnabled === "true",
        minecraftVersion,
      );
      store.setSelectedMods(synced);

      const payload = {
        profileId: store.form.profileId.trim(),
        serverName: store.form.serverName.trim(),
        serverAddress: store.form.serverAddress.trim(),
        minecraftVersion,
        loaderVersion,
        mods: synced,
        fancyMenu: collectFancyMenuPayload(store.form),
        branding: collectBrandingPayload(store.form),
      };

      const started = await requestJson<PublishStartPayload>(
        "/v1/admin/profile/publish/start",
        "POST",
        payload,
      );

      const published = await new Promise<PublishPayload>((resolve, reject) => {
        const stream = new EventSource(
          buildEventSourceUrl("/v1/admin/profile/publish/stream", {
            jobId: started.jobId,
          }),
        );

        const cleanup = () => stream.close();

        const onProgress = (event: Event) => {
          try {
            const parsed = JSON.parse(
              (event as MessageEvent<string>).data,
            ) as PublishProgressPayload;
            store.setStatus("publish", parsed.message, "idle");
          } catch {
            store.setStatus("publish", "Publishing next release...", "idle");
          }
        };

        const onDone = (event: Event) => {
          cleanup();
          try {
            resolve(
              JSON.parse(
                (event as MessageEvent<string>).data,
              ) as PublishPayload,
            );
          } catch {
            reject(new Error("Publish stream returned an invalid payload"));
          }
        };

        const onError = (event: Event) => {
          cleanup();
          try {
            const parsed = JSON.parse((event as MessageEvent<string>).data) as {
              message?: string;
            };
            reject(new Error(parsed.message || "Publish failed."));
          } catch {
            reject(new Error("Publish failed."));
          }
        };

        stream.addEventListener("progress", onProgress as EventListener);
        stream.addEventListener("done", onDone as EventListener);
        stream.addEventListener("error", onError as EventListener);
      });

      store.setForm((current) => ({
        ...current,
        currentVersion: published.version,
        currentReleaseVersion:
          published.releaseVersion || current.currentReleaseVersion,
      }));
      store.setBaselineMods([...synced]);
      store.setBaselineRuntime({ minecraftVersion, loaderVersion });
      store.setLastPublishedSnapshot(
        buildPublishSnapshot(
          {
            ...store.form,
            currentVersion: published.version,
            currentReleaseVersion:
              published.releaseVersion || store.form.currentReleaseVersion,
          },
          synced,
        ),
      );
      store.setHasSavedDraft(false);

      if (
        published.exarotonSync?.attempted &&
        !published.exarotonSync.success
      ) {
        store.setStatus(
          "publish",
          `${published.releaseVersion || `v${published.version}`} published. Exaroton sync warning: ${published.exarotonSync.message}`,
          "error",
        );
        return;
      }
      store.setStatus(
        "publish",
        `Published ${published.releaseVersion || `v${published.version}`} (${published.bumpType || "patch"}, +${published.summary.add} / ~${published.summary.update} / -${published.summary.remove}).`,
        "ok",
      );
    } catch (error) {
      store.setStatus(
        "publish",
        (error as Error).message || "Publish failed.",
        "error",
      );
    } finally {
      store.setBusy("publish", false);
    }
  };

  return {
    ...store,
    saveDraft,
    exarotonAction,
    publishProfile,
  };
}
