"use client";

import { memo } from "react";

import { useAdminStore } from "@/admin/shared/store/admin-store";

function NavIcon({
  view,
}: {
  view: "overview" | "identity" | "mods" | "fancy" | "servers" | "launcher";
}) {
  if (view === "overview") {
    return (
      <svg
        className="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }
  if (view === "identity") {
    return (
      <svg
        className="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    );
  }
  if (view === "mods") {
    return (
      <svg
        className="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  if (view === "fancy") {
    return (
      <svg
        className="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.5 1.5" />
        <path d="M14 11l4 4" />
      </svg>
    );
  }
  if (view === "servers") {
    return (
      <svg
        className="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    );
  }
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { view: "overview", label: "Overview" },
  { view: "identity", label: "Identity" },
  { view: "mods", label: "Mod Manager" },
  { view: "fancy", label: "Fancy Menu" },
  { view: "servers", label: "Servers" },
  { view: "launcher", label: "Launcher Pairing" },
] as const;

export const Sidebar = memo(function Sidebar() {
  const { view, setView, rail, selectedMods, hasPendingPublish, isBusy } =
    useAdminStore();

  return (
    <aside className="nav">
      <div className="brand">
        <h1>MSS+ Client Admin</h1>
        <span className="tag">Control Room</span>
      </div>

      <nav className="nav-list" aria-label="Sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${view === item.view ? "active" : ""}`}
            type="button"
            onClick={() => setView(item.view)}
          >
            <NavIcon view={item.view} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="nav-status">
        {isBusy.bootstrap ? (
          <>
            <div className="rail-chip rail-chip-loading">
              Loading runtime...
            </div>
            <div className="rail-chip rail-chip-loading">Loading loader...</div>
            <div className="rail-chip rail-chip-loading">Loading mods...</div>
          </>
        ) : (
          <>
            <div className="rail-chip">
              <b>MC</b> {rail.minecraft}
            </div>
            <div className="rail-chip">
              <b>Loader</b> {rail.fabric}
            </div>
            <div className="rail-chip">{selectedMods.length} mods</div>
            {hasPendingPublish ? (
              <div
                className="rail-chip"
                style={{
                  color: "var(--warning)",
                  borderColor: "var(--warning)",
                  background: "rgba(245,158,11,0.05)",
                  fontWeight: 600,
                }}
              >
                Requires Publish
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
});
