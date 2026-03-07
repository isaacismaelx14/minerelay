"use client";

import { Button } from "@/admin/shared/ui/button";
import { useOverviewPageModel } from "../hooks/use-overview-page-model";

const MODRINTH_FALLBACK_ICON_URL = "https://modrinth.com/favicon.ico";

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

  const statCards = [
    {
      label: "Add",
      value: summaryStats.add,
      color: "emerald",
      icon: "add_circle",
      bg: "from-emerald-500/10 to-emerald-500/0",
      ring: "ring-emerald-500/20",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "Remove",
      value: summaryStats.remove,
      color: "red",
      icon: "remove_circle",
      bg: "from-red-500/10 to-red-500/0",
      ring: "ring-red-500/20",
      text: "text-red-400",
      border: "border-red-500/30",
      glow: "shadow-red-500/10",
    },
    {
      label: "Update",
      value: summaryStats.update,
      color: "amber",
      icon: "update",
      bg: "from-amber-500/10 to-amber-500/0",
      ring: "ring-amber-500/20",
      text: "text-amber-400",
      border: "border-amber-500/30",
      glow: "shadow-amber-500/10",
    },
    {
      label: "Keep",
      value: summaryStats.keep,
      color: "indigo",
      icon: "check_circle",
      bg: "from-indigo-500/10 to-indigo-500/0",
      ring: "ring-indigo-500/20",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
      glow: "shadow-indigo-500/10",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`relative group rounded-2xl border ${card.border} bg-gradient-to-br ${card.bg} p-5 flex flex-col items-center gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${card.glow} overflow-hidden`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
            />
            <div className="relative flex items-center gap-2">
              <span
                className={`material-symbols-outlined ${card.text} text-[22px] opacity-70`}
              >
                {card.icon}
              </span>
              <span className="text-[2.2rem] font-bold leading-none tracking-tight text-white font-mono tabular-nums">
                {card.value}
              </span>
            </div>
            <span
              className={`relative text-xs font-semibold uppercase tracking-widest ${card.text} opacity-80`}
            >
              {card.label}
            </span>
          </div>
        ))}
      </div>

      {/* Info Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Instance Profile */}
        <article className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-indigo-400 text-[18px]">
                  dns
                </span>
              </div>
              <h3 className="m-0 text-base font-semibold text-white">
                Instance Profile
              </h3>
            </div>
            <Button variant="outline" size="xs" onClick={goToIdentity}>
              Edit
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow label="Profile Name" value={form.serverName} />
            <InfoRow
              label="Runtime"
              value={`${rail.minecraft} | ${rail.fabric}`}
            />
            <InfoRow label="Endpoint" value={form.serverAddress} />
          </div>
        </article>

        {/* Content Catalog */}
        <article className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                  inventory_2
                </span>
              </div>
              <h3 className="m-0 text-base font-semibold text-white">
                Content Catalog
              </h3>
            </div>
            <Button variant="outline" size="xs" onClick={goToMods}>
              Manage
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow label="Total Mods" value={selectedMods.length} />
            <InfoRow label="Core Mods" value="2 (Managed)" />
            <InfoRow
              label="Update Status"
              value={
                summaryStats.update > 0
                  ? `${summaryStats.update} pending`
                  : "All current"
              }
              highlight={summaryStats.update > 0 ? "warning" : "success"}
            />
          </div>
        </article>

        {/* Display & Menu */}
        <article className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-400 text-[18px]">
                  palette
                </span>
              </div>
              <h3 className="m-0 text-base font-semibold text-white">
                Display & Menu
              </h3>
            </div>
            <Button variant="outline" size="xs" onClick={goToFancy}>
              Setup
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <InfoRow
              label="Status"
              value={form.fancyMenuEnabled === "true" ? "Active" : "Bypass"}
              highlight={
                form.fancyMenuEnabled === "true" ? "success" : undefined
              }
            />
            <InfoRow
              label="Mode"
              value={
                form.fancyMenuMode === "custom" ? "Custom Bundle" : "Simplified"
              }
            />
            <InfoRow
              label="Custom Brand"
              value={form.brandingLogoUrl ? "Logo Set" : "Default"}
            />
          </div>
        </article>
      </div>

      {/* Recent Mods */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-sky-400 text-[18px]">
                extension
              </span>
            </div>
            <h3 className="m-0 text-base font-semibold text-white">
              Recent Mods
            </h3>
            <span className="text-xs text-[var(--color-text-muted)] bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">
              {selectedMods.length} total
            </span>
          </div>
          <Button variant="outline" size="xs" onClick={goToMods}>
            View All
          </Button>
        </div>
        <div className="grid gap-2">
          {selectedMods.slice(0, 5).map((mod) => (
            <div
              key={mod.projectId || mod.name}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-black/30 border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mod.iconUrl || MODRINTH_FALLBACK_ICON_URL}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallbackApplied === "true") {
                      return;
                    }
                    image.dataset.fallbackApplied = "true";
                    image.src = MODRINTH_FALLBACK_ICON_URL;
                  }}
                />
              </div>
              <span className="text-sm font-medium text-white truncate flex-1">
                {mod.name}
              </span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-black/20 px-2 py-0.5 rounded border border-white/[0.04] shrink-0 uppercase tracking-wider max-w-[100px] truncate">
                {mod.versionId || "Custom"}
              </span>
            </div>
          ))}
          {selectedMods.length > 5 ? (
            <button
              className="text-xs text-[var(--color-text-muted)] hover:text-white mt-1 py-2 text-center rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer border-none bg-transparent"
              onClick={goToMods}
            >
              +{selectedMods.length - 5} more mods...
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg bg-black/15 border border-white/[0.04]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
        {label}
      </span>
      <span
        className={`text-sm font-medium truncate text-right ${
          highlight === "success"
            ? "text-emerald-400"
            : highlight === "warning"
              ? "text-amber-400"
              : "text-[var(--color-text-primary)]"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}
