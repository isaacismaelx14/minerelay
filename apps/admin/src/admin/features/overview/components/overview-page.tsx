"use client";

import { InfoPanel, InfoRow, RecentModsPanel, StatCard } from "@minerelay/ui";
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

  const statCards = [
    {
      label: "Add",
      value: summaryStats.add,
      icon: "add_circle",
      tone: "emerald",
    },
    {
      label: "Remove",
      value: summaryStats.remove,
      icon: "remove_circle",
      tone: "red",
    },
    {
      label: "Update",
      value: summaryStats.update,
      icon: "update",
      tone: "amber",
    },
    {
      label: "Keep",
      value: summaryStats.keep,
      icon: "check_circle",
      tone: "indigo",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      {/* Info Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Instance Profile */}
        <InfoPanel
          icon="dns"
          title="Instance Profile"
          iconClassName="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          actionLabel="Edit"
          onAction={goToIdentity}
        >
          <InfoRow label="Profile Name" value={form.serverName} />
          <InfoRow
            label="Runtime"
            value={`${rail.minecraft} | ${rail.fabric}`}
          />
          <InfoRow label="Endpoint" value={form.serverAddress} />
        </InfoPanel>

        {/* Content Catalog */}
        <InfoPanel
          icon="inventory_2"
          title="Content Catalog"
          iconClassName="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          actionLabel="Manage"
          onAction={goToMods}
        >
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
        </InfoPanel>

        {/* Display & Menu */}
        <InfoPanel
          icon="palette"
          title="Display & Menu"
          iconClassName="bg-violet-500/10 border-violet-500/20 text-violet-400"
          actionLabel="Setup"
          onAction={goToFancy}
        >
          <InfoRow
            label="Status"
            value={form.fancyMenuEnabled === "true" ? "Active" : "Bypass"}
            highlight={form.fancyMenuEnabled === "true" ? "success" : undefined}
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
        </InfoPanel>
      </div>

      {/* Recent Mods */}
      <RecentModsPanel
        totalCount={selectedMods.length}
        onViewAll={goToMods}
        items={selectedMods.slice(0, 5).map((mod) => ({
          key: `${mod.projectId ?? mod.name}-${mod.versionId ?? "custom"}`,
          name: mod.name,
          version: mod.versionId || "Custom",
          iconUrl: mod.iconUrl,
        }))}
      />
    </div>
  );
}
