"use client";

import { useEffect } from "react";
import type { MinecraftVersionEntry } from "../hooks/use-onboarding-model";
import { Button, Select } from "@minerelay/ui";

type Props = {
  mcVersion: string;
  loaderVersion: string;
  loaderLatestStable: string;
  mcVersions: MinecraftVersionEntry[];
  isLoadingVersions: boolean;
  onSelectMcVersion: (version: string) => void;
  onNext: () => void;
  onFetchVersions: () => void;
};

export function StepVersion({
  mcVersion,
  loaderVersion,
  loaderLatestStable,
  mcVersions,
  isLoadingVersions,
  onSelectMcVersion,
  onNext,
  onFetchVersions,
}: Props) {
  useEffect(() => {
    onFetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stableVersions = mcVersions.filter((v) => v.stable);

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[8px]">
        <h2 className="text-[1.5rem] font-bold tracking-tight text-[var(--color-text-primary)]">
          Choose your Minecraft version
        </h2>
        <p className="text-[0.9375rem] text-[var(--color-text-secondary)] leading-relaxed">
          Select the Minecraft version your modpack will target. Only stable
          Fabric-supported versions are shown.
        </p>
      </div>

      <div className="flex flex-col gap-[6px]">
        <label
          htmlFor="mcVersion"
          className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
        >
          Minecraft Version
        </label>
        {isLoadingVersions ? (
          <div className="h-[52px] rounded-[var(--radius-md)] bg-[var(--color-bg-surface-elevated)] animate-pulse" />
        ) : (
          <Select
            name="mcVersion"
            value={mcVersion || ""}
            options={[
              { value: "", label: "Select a version…" },
              ...stableVersions.map((v) => ({
                value: v.version,
                label: v.version,
              })),
            ]}
            onChange={(e) => onSelectMcVersion(e.target.value)}
          />
        )}
      </div>

      {mcVersion && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line-soft)] bg-[var(--color-bg-surface-elevated)] p-[16px] flex items-center gap-[16px] shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] h-[44px] w-[44px] items-center justify-center rounded-full ring-[4px] ring-[var(--color-brand-primary)]/5">
            <span className="material-symbols-outlined text-[20px]">
              check_circle
            </span>
          </div>
          <div className="flex flex-col gap-[2px]">
            <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Fabric Loader
            </span>
            <span className="text-[0.9375rem] font-medium text-[var(--color-text-primary)]">
              {loaderLatestStable
                ? `${loaderLatestStable} (latest stable)`
                : loaderVersion || "Auto-selecting…"}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-[8px]">
        <Button
          variant="primary"
          disabled={!mcVersion || !loaderVersion}
          onClick={onNext}
        >
          Next
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </Button>
      </div>
    </div>
  );
}
