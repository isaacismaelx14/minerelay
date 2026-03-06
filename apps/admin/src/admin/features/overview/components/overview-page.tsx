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
      <div className="summary-bar">
        <div className="summary-item add">
          <span className="summary-value">{summaryStats.add}</span>
          <span className="summary-label">Add</span>
        </div>
        <div className="summary-item remove">
          <span className="summary-value">{summaryStats.remove}</span>
          <span className="summary-label">Remove</span>
        </div>
        <div className="summary-item update">
          <span className="summary-value">{summaryStats.update}</span>
          <span className="summary-label">Update</span>
        </div>
        <div className="summary-item keep">
          <span className="summary-value">{summaryStats.keep}</span>
          <span className="summary-label">Keep</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <h3>Instance Profile</h3>
            <button className="btn ghost" onClick={goToIdentity}>
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

        <article className="panel">
          <div className="panel-header">
            <h3>Content Catalog</h3>
            <button className="btn ghost" onClick={goToMods}>
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

        <article className="panel">
          <div className="panel-header">
            <h3>Display & Menu</h3>
            <button className="btn ghost" onClick={goToFancy}>
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

        <article className="panel">
          <div className="panel-header">
            <h3>Recent Mods</h3>
          </div>
          <div className="list compact">
            {selectedMods.slice(0, 5).map((mod) => (
              <div key={mod.projectId || mod.name} className="item">
                <span className="name">{mod.name}</span>
                <span className="meta">{mod.versionId || "Custom"}</span>
              </div>
            ))}
            {selectedMods.length > 5 ? (
              <span className="meta">
                and {selectedMods.length - 5} more...
              </span>
            ) : null}
          </div>
        </article>
      </div>
    </>
  );
}
