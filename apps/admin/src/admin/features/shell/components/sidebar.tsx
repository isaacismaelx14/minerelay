"use client";

import { memo } from "react";

import { useAdminStore } from "@/admin/shared/store/admin-store";

function NavIcon({
  view,
}: {
  view: "overview" | "identity" | "assets" | "fancy" | "servers" | "launcher";
}) {
  if (view === "overview") {
    return (
      <svg
        className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
        className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
  if (view === "assets") {
    return (
      <svg
        className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
        className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
        className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
      className="w-[18px] h-[18px] opacity-70 transition-all duration-150 text-current group-hover:opacity-100 group-hover:text-[var(--color-brand-accent)] group-hover:scale-110 group-data-[active=true]:opacity-100 group-data-[active=true]:text-[var(--color-brand-accent)] group-data-[active=true]:scale-110"
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
  { view: "assets", label: "Assets" },
  { view: "fancy", label: "Fancy Menu" },
  { view: "servers", label: "Servers" },
  { view: "launcher", label: "Launcher Pairing" },
] as const;

export const Sidebar = memo(function Sidebar() {
  const {
    view,
    setView,
    rail,
    selectedMods,
    selectedResources,
    selectedShaders,
    hasPendingPublish,
    isBusy,
  } = useAdminStore();

  return (
    <aside className="border border-[var(--color-line)] rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] backdrop-blur-[var(--blur-glass)] p-[24px] grid grid-rows-[auto_1fr_auto] gap-[32px] animate-[fadeIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
      <div className="grid gap-[4px] pb-[16px] border-b border-[var(--color-line)]">
        <h1 className="m-0 text-[1.25rem] font-bold bg-gradient-to-br from-white to-[#a5b4fc] text-transparent bg-clip-text tracking-[-0.01em]">
          MineRelay Admin
        </h1>
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-[var(--color-brand-accent)] font-medium">
          Control Room
        </span>
      </div>

      <nav className="grid content-start gap-[8px]" aria-label="Sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`border border-transparent rounded-[var(--radius-md)] bg-transparent text-[var(--color-text-secondary)] py-[14px] px-[20px] text-[0.95rem] font-medium cursor-pointer flex items-center gap-[14px] transition-all duration-150 ease-out text-left w-full relative hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:translate-x-[4px] group before:absolute before:left-0 before:top-[25%] before:bottom-[25%] before:w-[3px] before:bg-[var(--color-brand-primary)] before:scale-y-0 before:transition-transform before:duration-150 before:rounded-r-[4px] hover:before:scale-y-[0.6] data-[active=true]:before:scale-y-[1.5] data-[active=true]:before:top-[15%] data-[active=true]:before:bottom-[15%] data-[active=true]:bg-gradient-to-r data-[active=true]:from-[rgba(99,102,241,0.15)] data-[active=true]:to-[rgba(99,102,241,0.02)] data-[active=true]:border-[rgba(99,102,241,0.2)] data-[active=true]:text-white data-[active=true]:font-semibold`}
            data-active={view === item.view}
            type="button"
            onClick={() => setView(item.view)}
          >
            <NavIcon view={item.view} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="grid gap-[8px]">
        {isBusy.bootstrap ? (
          <>
            <div className="text-[0.82rem] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex items-center gap-[12px] text-[var(--color-text-muted)] italic justify-center">
              Loading runtime...
            </div>
            <div className="text-[0.82rem] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex items-center gap-[12px] text-[var(--color-text-muted)] italic justify-center">
              Loading loader...
            </div>
            <div className="text-[0.82rem] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex items-center gap-[12px] text-[var(--color-text-muted)] italic justify-center">
              Loading mods...
            </div>
          </>
        ) : (
          <>
            <div className="text-[0.82rem] text-[var(--color-text-primary)] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]">
              <b className="text-[var(--color-text-secondary)]">MC</b>{" "}
              {rail.minecraft}
            </div>
            <div className="text-[0.82rem] text-[var(--color-text-primary)] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]">
              <b className="text-[var(--color-text-secondary)]">Loader</b>{" "}
              {rail.fabric}
            </div>
            <div className="text-[0.82rem] text-[var(--color-text-primary)] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]">
              {selectedMods.length} mods
            </div>
            <div className="text-[0.82rem] text-[var(--color-text-primary)] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]">
              {selectedResources.length} resourcepacks
            </div>
            <div className="text-[0.82rem] text-[var(--color-text-primary)] bg-black/20 border border-[var(--color-line)] rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]">
              {selectedShaders.length} shaderpacks
            </div>
            {hasPendingPublish ? (
              <div
                className="text-[0.82rem] bg-black/20 border rounded-[var(--radius-sm)] py-[8px] px-[12px] flex justify-between items-center gap-[12px]"
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
