"use client";

import React from "react";
import { statusClass } from "@/admin/shared/ui/status";

import { useAssetsPageModel } from "../hooks/use-assets-page-model";
import { AssetRegion, ModsRegion } from "./assets-regions";
import { PopularAssetModal } from "./popular-asset-modal";

function makeDraftKeySet(
  baseline: Array<{ projectId?: string; sha256: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const entry of baseline) {
    keys.add(entry.projectId ?? entry.sha256);
  }
  return keys;
}

function makeProjectIdSet(entries: Array<{ projectId?: string }>): Set<string> {
  const projectIds = new Set<string>();
  for (const entry of entries) {
    const projectId = entry.projectId?.trim();
    if (projectId) {
      projectIds.add(projectId);
    }
  }
  return projectIds;
}

export function AssetsPage() {
  const {
    status,
    selectedMods,
    selectedResources,
    selectedShaders,
    baselineMods,
    baselineResources,
    baselineShaders,
    openModsManager,
    modalType,
    popular,
    loadingPopular,
    installingId,
    searchQuery,
    executeSearch,
    openPopularModal,
    closePopularModal,
    installFromPopular,
    installedModProjectIds,
    removeResource,
    removeShader,
  } = useAssetsPageModel();

  const publishedModKeys = React.useMemo(
    () => makeDraftKeySet(baselineMods),
    [baselineMods],
  );
  const publishedResourceKeys = React.useMemo(
    () => makeDraftKeySet(baselineResources),
    [baselineResources],
  );
  const publishedShaderKeys = React.useMemo(
    () => makeDraftKeySet(baselineShaders),
    [baselineShaders],
  );
  const installedResourceProjectIds = React.useMemo(
    () => makeProjectIdSet(selectedResources),
    [selectedResources],
  );
  const installedShaderProjectIds = React.useMemo(
    () => makeProjectIdSet(selectedShaders),
    [selectedShaders],
  );

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight m-0">Assets</h1>
          <p className="text-[var(--color-text-muted)] mt-1 mb-0 text-sm">
            Manage user-side assets. Mods, resourcepacks, and shaderpacks are
            tracked here.
          </p>
        </div>
      </div>

      {status.text ? (
        <div className={statusClass(status.tone)}>{status.text}</div>
      ) : null}

      <div className="flex flex-col gap-8">
        <ModsRegion
          selectedMods={selectedMods}
          publishedModKeys={publishedModKeys}
          onOpenModsManager={openModsManager}
        />

        <AssetRegion
          title="Resourcepacks"
          icon="texture"
          iconClassName="text-[#10b981]"
          installedClassName="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981]"
          count={selectedResources.length}
          addLabel="Add Resourcepack"
          onAdd={() => void openPopularModal("resourcepack")}
          emptyTitle="No resourcepacks found"
          emptyDescription="Resourcepacks can change the look of blocks, items, and UI. Add some to customize your world."
          emptyIcon="texture"
          entries={selectedResources}
          publishedKeys={publishedResourceKeys}
          fallbackLetter="R"
          defaultTag="custom pack"
          onRemove={removeResource}
        />

        <AssetRegion
          title="Shaderpacks"
          icon="gradient"
          iconClassName="text-[#a855f7]"
          installedClassName="bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#c084fc]"
          count={selectedShaders.length}
          addLabel="Add Shaderpack"
          onAdd={() => void openPopularModal("shaderpack")}
          emptyTitle="No shaderpacks installed"
          emptyDescription="Shaderpacks dramatically improve lighting, shadows, and water. Browse the gallery to find one."
          emptyIcon="gradient"
          entries={selectedShaders}
          publishedKeys={publishedShaderKeys}
          fallbackLetter="S"
          defaultTag="custom shader"
          onRemove={removeShader}
        />
      </div>

      {modalType ? (
        <PopularAssetModal
          type={modalType}
          popular={popular}
          loading={loadingPopular}
          installingId={installingId}
          searchQuery={searchQuery}
          onSearch={executeSearch}
          onClose={closePopularModal}
          onInstall={installFromPopular}
          installedModProjectIds={installedModProjectIds}
          installedAssetProjectIds={
            modalType === "resourcepack"
              ? installedResourceProjectIds
              : installedShaderProjectIds
          }
        />
      ) : null}
    </div>
  );
}
