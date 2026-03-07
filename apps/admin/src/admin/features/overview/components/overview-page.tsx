"use client";

import { DataItem, DataList } from "@/admin/shared/ui/data-list";

import { useOverviewPageModel } from "../hooks/use-overview-page-model";

export function OverviewPage() {
  const {
    form,
    selectedMods,
    summaryStats,
    rail,
    goToIdentity,
    goToMods,
    goToFancy,
  } = useOverviewPageModel();

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[24px]">
        <div className="border border-[var(--color-line)] rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-[24px] flex flex-col justify-center items-center gap-[8px] relative overflow-hidden transition-all duration-300 border-l-[4px] border-l-[#10b981] bg-gradient-to-br from-[#10b981]/5 to-transparent">
          <span className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-white font-mono">
            {summaryStats.add}
          </span>
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
            Add
          </span>
        </div>
        <div className="border border-[var(--color-line)] rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-[24px] flex flex-col justify-center items-center gap-[8px] relative overflow-hidden transition-all duration-300 border-l-[4px] border-l-[#ef4444] bg-gradient-to-br from-[#ef4444]/5 to-transparent">
          <span className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-white font-mono">
            {summaryStats.remove}
          </span>
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
            Remove
          </span>
        </div>
        <div className="border border-[var(--color-line)] rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-[24px] flex flex-col justify-center items-center gap-[8px] relative overflow-hidden transition-all duration-300 border-l-[4px] border-l-[#f59e0b] bg-gradient-to-br from-[#f59e0b]/5 to-transparent">
          <span className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-white font-mono">
            {summaryStats.update}
          </span>
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
            Update
          </span>
        </div>
        <div className="border border-[var(--color-line)] rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-[24px] flex flex-col justify-center items-center gap-[8px] relative overflow-hidden transition-all duration-300 border-l-[4px] border-l-[#6366f1] bg-gradient-to-br from-[#6366f1]/5 to-transparent">
          <span className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-white font-mono">
            {summaryStats.keep}
          </span>
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
            Keep
          </span>
        </div>
      </div>

      <div className="mt-[32px] grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-[24px]">
        <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
          <div className="flex items-center justify-between mb-[4px]">
            <h3 className="m-0 mb-2 text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
              Instance Profile
            </h3>
            <button
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              onClick={goToIdentity}
            >
              Edit
            </button>
          </div>
          <DataList>
            <DataItem label="Profile Name" value={form.serverName} />
            <DataItem
              label="Runtime"
              value={`${rail.minecraft} | ${rail.fabric}`}
            />
            <DataItem label="Endpoint" value={form.serverAddress} />
          </DataList>
        </article>

        <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
          <div className="flex items-center justify-between mb-[4px]">
            <h3 className="m-0 mb-2 text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
              Content Catalog
            </h3>
            <button
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              onClick={goToMods}
            >
              Manage
            </button>
          </div>
          <DataList>
            <DataItem label="Total Mods" value={selectedMods.length} />
            <DataItem label="Core Mods" value="2 (Managed)" />
            <DataItem
              label="Update Status"
              value={
                summaryStats.update > 0
                  ? `${summaryStats.update} pending`
                  : "All current"
              }
            />
          </DataList>
        </article>

        <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
          <div className="flex items-center justify-between mb-[4px]">
            <h3 className="m-0 mb-2 text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
              Display & Menu
            </h3>
            <button
              className="border border-white/5 rounded-[var(--radius-md)] py-[12px] px-[20px] font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] inline-flex items-center justify-center text-[0.9rem] gap-[8px] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-b after:from-white/20 after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 hover:not-disabled:after:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale-[0.8] hover:not-disabled:-translate-y-[2px] disabled:shadow-none disabled:transform-none bg-white/5 text-[var(--color-text-secondary)] shadow-none backdrop-blur-[4px] hover:not-disabled:bg-white/10 hover:not-disabled:border-white/15 hover:not-disabled:text-white hover:not-disabled:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              onClick={goToFancy}
            >
              Setup
            </button>
          </div>
          <DataList>
            <DataItem
              label="Status"
              value={form.fancyMenuEnabled === "true" ? "Active" : "Bypass"}
            />
            <DataItem
              label="Mode"
              value={
                form.fancyMenuMode === "custom" ? "Custom Bundle" : "Simplified"
              }
            />
            <DataItem
              label="Custom Brand"
              value={form.brandingLogoUrl ? "Logo Set" : "Default"}
            />
          </DataList>
        </article>

        <article className="bg-[var(--color-bg-card)] border border-[var(--color-line)] rounded-[var(--radius-lg)] p-[24px] flex flex-col gap-[16px] transition-all duration-150 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-line-strong)] hover:-translate-y-[2px]">
          <div className="flex items-center justify-between mb-[4px]">
            <h3 className="m-0 mb-2 text-[1.25rem] font-semibold text-white tracking-[-0.01em]">
              Recent Mods
            </h3>
          </div>
          <div className="grid gap-[8px]">
            {selectedMods.slice(0, 5).map((mod) => (
              <div
                key={mod.projectId || mod.name}
                className="flex justify-between items-center gap-[16px] py-[6px] px-[8px] border border-[var(--color-line)] rounded-[var(--radius-md)] bg-white/2"
              >
                <span className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                  {mod.name}
                </span>
                <span className="text-[0.74rem] text-[var(--color-text-muted)] uppercase tracking-[0.05em] whitespace-nowrap overflow-hidden text-ellipsis">
                  {mod.versionId || "Custom"}
                </span>
              </div>
            ))}
            {selectedMods.length > 5 ? (
              <span className="text-[0.8rem] text-[var(--color-text-secondary)] mt-[10px] mx-[4px] inline-block">
                and {selectedMods.length - 5} more...
              </span>
            ) : null}
          </div>
        </article>
      </div>
    </>
  );
}
