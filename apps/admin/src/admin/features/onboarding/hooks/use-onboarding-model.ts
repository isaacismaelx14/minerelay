"use client";

import { useCallback, useState } from "react";
import { useAdminContext } from "@/admin/client/admin-context";
import { uploadForm, requestJson } from "@/admin/client/http";

export type OnboardingStep = "version" | "identity" | "complete";

export type MinecraftVersionEntry = {
  version: string;
  stable: boolean;
};

export type OnboardingFormState = {
  mcVersion: string;
  loaderVersion: string;
  loaderLatestStable: string;
  displayName: string;
  serverAddress: string;
  logoFile: File | null;
  logoPreview: string;
  bgFile: File | null;
  bgPreview: string;
};

export type CompletedOnboardingState = {
  profileId: string;
  version: number;
  releaseVersion: string;
  displayName: string;
  serverAddress: string;
  minecraftVersion: string;
  loader: "fabric";
  loaderVersion: string;
  brandingLogoUrl?: string;
  brandingBackgroundUrl?: string;
  fancyMenuEnabled: false;
  baseModCount: number;
};

const INITIAL_FORM: OnboardingFormState = {
  mcVersion: "",
  loaderVersion: "",
  loaderLatestStable: "",
  displayName: "",
  serverAddress: "",
  logoFile: null,
  logoPreview: "",
  bgFile: null,
  bgPreview: "",
};

export function useOnboardingModel() {
  const admin = useAdminContext();
  const [step, setStep] = useState<OnboardingStep>("version");
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_FORM);
  const [completed, setCompleted] = useState<CompletedOnboardingState | null>(
    null,
  );
  const [mcVersions, setMcVersions] = useState<MinecraftVersionEntry[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMinecraftVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    setError(null);
    try {
      const data = await requestJson<{ versions: MinecraftVersionEntry[] }>(
        "/v1/admin/minecraft/versions",
        "GET",
      );
      setMcVersions(data.versions);
    } catch (err) {
      setError((err as Error).message || "Failed to load Minecraft versions.");
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  const selectMcVersion = useCallback(async (version: string) => {
    setForm((current) => ({
      ...current,
      mcVersion: version,
      loaderVersion: "",
      loaderLatestStable: "",
    }));
    if (!version) return;

    try {
      const data = await requestJson<{
        loaders: Array<{ version: string; stable: boolean }>;
        latestStable: string | null;
      }>(
        `/v1/admin/fabric/versions?minecraftVersion=${encodeURIComponent(version)}`,
        "GET",
      );
      const latestStable = data.latestStable ?? data.loaders[0]?.version ?? "";
      setForm((current) => ({
        ...current,
        loaderVersion: latestStable,
        loaderLatestStable: latestStable,
      }));
    } catch {
      // non-fatal: will be caught on submit
    }
  }, []);

  const setField = useCallback(
    (field: keyof OnboardingFormState, value: string) => {
      setForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const setImageFile = useCallback(
    (target: "logo" | "bg", file: File | null) => {
      if (!file) {
        setForm((current) => ({
          ...current,
          ...(target === "logo"
            ? { logoFile: null, logoPreview: "" }
            : { bgFile: null, bgPreview: "" }),
        }));
        return;
      }

      const preview = URL.createObjectURL(file);
      setForm((current) => ({
        ...current,
        ...(target === "logo"
          ? { logoFile: file, logoPreview: preview }
          : { bgFile: file, bgPreview: preview }),
      }));
    },
    [],
  );

  const nextStep = useCallback(() => {
    setStep((current) => (current === "version" ? "identity" : "complete"));
    setError(null);
  }, []);

  const prevStep = useCallback(() => {
    setStep((current) => (current === "identity" ? "version" : current));
    setError(null);
  }, []);

  const completeSetup = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let logoUrl: string | undefined;
      let bgUrl: string | undefined;

      if (form.logoFile) {
        const fd = new FormData();
        fd.append("file", form.logoFile);
        const res = await uploadForm<{ url: string }>(
          "/v1/admin/media/upload",
          fd,
        );
        logoUrl = res.url;
      }

      if (form.bgFile) {
        const fd = new FormData();
        fd.append("file", form.bgFile);
        const res = await uploadForm<{ url: string }>(
          "/v1/admin/media/upload",
          fd,
        );
        bgUrl = res.url;
      }

      const payload = await requestJson<CompletedOnboardingState>(
        "/v1/admin/onboarding/complete",
        "POST",
        {
          displayName: form.displayName.trim(),
          serverAddress: form.serverAddress.trim() || undefined,
          minecraftVersion: form.mcVersion,
          loaderVersion: form.loaderVersion,
          ...(logoUrl ? { brandingLogoUrl: logoUrl } : {}),
          ...(bgUrl ? { brandingBackgroundUrl: bgUrl } : {}),
        },
      );

      setCompleted(payload);
      try {
        await admin.loadBootstrap(true);
      } catch {
        // Keep the completion summary visible even if the refresh fails.
      }
      window.dispatchEvent(new Event("admin:onboarding-complete"));
      setStep("complete");
    } catch (err) {
      setError((err as Error).message || "Setup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [admin, form]);

  return {
    completed,
    step,
    form,
    mcVersions,
    isLoadingVersions,
    isSubmitting,
    error,
    fetchMinecraftVersions,
    selectMcVersion,
    setField,
    setImageFile,
    nextStep,
    prevStep,
    completeSetup,
  };
}
