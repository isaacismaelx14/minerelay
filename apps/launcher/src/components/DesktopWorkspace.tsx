import { lazy, Suspense } from "react";
import type { useAppCore } from "../hooks/useAppCore";
import { formatTime } from "../utils";
import { Button } from "@minerelay/ui";
import type { DesktopWorkspacePageStyles } from "./desktop-workspace-pages/types";

const OverviewPage = lazy(() =>
  import("./desktop-workspace-pages/OverviewPage").then((m) => ({
    default: m.OverviewPage,
  })),
);
const SourcePathsPage = lazy(() =>
  import("./desktop-workspace-pages/SourcePathsPage").then((m) => ({
    default: m.SourcePathsPage,
  })),
);
const CatalogPage = lazy(() =>
  import("./desktop-workspace-pages/CatalogPage").then((m) => ({
    default: m.CatalogPage,
  })),
);
const ActivityPage = lazy(() =>
  import("./desktop-workspace-pages/ActivityPage").then((m) => ({
    default: m.ActivityPage,
  })),
);

export function DesktopWorkspace({
  core,
}: {
  core: ReturnType<typeof useAppCore>;
}) {
  const blockClass =
    "grid content-start gap-6 animate-[fadeIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_0.1s_both]";
  const paneHeadClass = "grid gap-1.5";
  const subtitleClass =
    "text-[0.9rem] leading-[1.5] text-[var(--color-text-secondary)] max-[920px]:text-[0.8rem]";
  const paneGridClass =
    "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 max-[1280px]:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] max-[1080px]:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] max-[920px]:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] max-[920px]:gap-3";
  const panelCardClass =
    "relative grid content-start gap-[18px] overflow-hidden rounded-[20px] border border-[var(--color-line)] bg-[var(--color-bg-card)] p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)] hover:-translate-y-0.5 hover:border-[var(--color-line-strong)] hover:bg-[var(--color-bg-card-hover)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)] max-[920px]:gap-3 max-[920px]:p-3";
  const h3Class =
    "text-[1.1rem] font-semibold tracking-[0.01em] text-white max-[920px]:text-[1rem]";
  const dataListClass = "grid gap-[18px]";
  const dataItemClass = "grid gap-1";
  const dataLabelClass =
    "text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]";
  const dataValueClass =
    "break-all rounded-[8px] border border-[var(--color-line)] bg-[rgba(0,0,0,0.2)] px-3 py-2 font-mono text-[0.9rem] leading-[1.4] text-[var(--color-text-primary)] transition-all duration-150 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--color-line-strong)] hover:bg-[rgba(255,255,255,0.03)]";
  const summaryGridClass =
    "grid list-none grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-[18px] p-0 max-[920px]:grid-cols-2 max-[920px]:gap-3";
  const summaryItemClass =
    "grid gap-1 rounded-[12px] border border-[var(--color-line)] bg-[rgba(0,0,0,0.2)] px-3 py-4 text-center transition-transform duration-150 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.03] hover:border-[var(--color-brand-indigo-border)] hover:bg-[var(--color-brand-indigo-bg)] max-[920px]:px-1.5 max-[920px]:py-2.5";
  const summaryValueClass = "text-[1.4rem] font-bold text-white";
  const summaryLabelClass =
    "text-[0.8rem] font-medium uppercase tracking-[0.05em] text-[var(--color-text-muted)]";
  const overviewListClass = "flex flex-wrap content-start gap-2";
  const overviewChipClass =
    "rounded-[8px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 font-mono text-[0.8rem] text-[var(--color-text-secondary)] transition-all duration-150 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:border-[var(--color-line-strong)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white max-[920px]:px-1.5 max-[920px]:py-[3px] max-[920px]:text-[0.7rem]";
  const actionsRowClass = "flex flex-wrap gap-[18px]";
  const baseButtonClass =
    "relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[12px] px-[18px] py-2.5 text-[0.95rem] font-semibold transition-all duration-150 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] after:pointer-events-none after:absolute after:left-[-100%] after:top-0 after:h-full after:w-1/2 after:skew-x-[-20deg] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] after:transition-[left] after:duration-500 hover:after:left-[150%] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale";
  const primaryButtonClass = `${baseButtonClass} border-0 bg-[linear-gradient(135deg,var(--color-brand-indigo),var(--color-brand-accent))] bg-[length:200%_200%] text-white shadow-[0_4px_15px_var(--color-brand-indigo-shadow)] hover:-translate-y-px hover:animate-[gradientShift_3s_ease_infinite] hover:shadow-[0_6px_20px_var(--color-brand-indigo-shadow)] active:translate-y-px`;
  const ghostButtonClass = `${baseButtonClass} border border-[var(--color-line)] bg-[rgba(255,255,255,0.05)] text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white`;
  const inputBaseClass =
    "w-full rounded-[12px] border border-[var(--color-line-strong)] bg-[rgba(0,0,0,0.2)] px-[14px] py-3 text-[0.95rem] text-[var(--color-text-primary)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)] focus:bg-[rgba(0,0,0,0.3)] focus:shadow-[0_0_0_3px_var(--color-brand-primary-glow),inset_0_2px_4px_rgba(0,0,0,0.1)] focus:outline-none";
  const selectClass = `${inputBaseClass} cursor-pointer appearance-none pr-10`;
  const detailsClass = "mt-3";
  const meterClass =
    "relative h-2 overflow-hidden rounded-[999px] bg-[rgba(0,0,0,0.4)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]";
  const metricsClass =
    "flex justify-between gap-3 font-mono text-[0.85rem] text-[var(--color-text-muted)]";
  const navButtonBaseClass =
    "group relative flex items-center gap-3 overflow-hidden rounded-[12px] border border-transparent bg-transparent px-4 py-3 text-left text-[0.95rem] font-medium text-[var(--color-text-secondary)] transition-all duration-150 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:scale-y-0 before:rounded-r-[4px] before:bg-[var(--color-brand-indigo)] before:transition-transform before:duration-150 before:[transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:translate-x-1 hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:before:scale-y-[0.4] max-[1080px]:h-12 max-[1080px]:w-12 max-[1080px]:justify-center max-[1080px]:p-3";

  const {
    APP_NAME,
    SERVER_ID,
    catalog,
    sessionStatus,
    activeView,
    setActiveView,
    lastCheckAt,
    nextCheckAt,
    versionReadiness,
    launcherUpdate,
    launcherAppVersion,
    launcherStreamStatus,
    canRenderLogo,
    markLogoAsBroken,
    returnToMainWindow,
    sourceLabel,
    isActionBusy,
  } = core;

  const pageStyles: DesktopWorkspacePageStyles = {
    blockClass,
    paneHeadClass,
    subtitleClass,
    paneGridClass,
    panelCardClass,
    h3Class,
    dataListClass,
    dataItemClass,
    dataLabelClass,
    dataValueClass,
    summaryGridClass,
    summaryItemClass,
    summaryValueClass,
    summaryLabelClass,
    overviewListClass,
    overviewChipClass,
    actionsRowClass,
    primaryButtonClass,
    ghostButtonClass,
    inputBaseClass,
    selectClass,
    detailsClass,
    meterClass,
    metricsClass,
  };

  const renderWorkspace = () => {
    if (activeView === "sourcePaths") {
      return <SourcePathsPage core={core} styles={pageStyles} />;
    }

    if (activeView === "catalog") {
      return <CatalogPage core={core} styles={pageStyles} />;
    }

    if (activeView === "activity") {
      return <ActivityPage core={core} styles={pageStyles} />;
    }

    return <OverviewPage core={core} styles={pageStyles} />;
  };

  return (
    <main className="grid h-screen animate-[fadeIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] grid-cols-[280px_minmax(0,1fr)] gap-6 overflow-hidden p-6 max-[1280px]:grid-cols-[240px_minmax(0,1fr)] max-[1080px]:grid-cols-[80px_minmax(0,1fr)] max-[1080px]:gap-4.5 max-[1080px]:p-4.5">
      <aside className="border-line bg-bg-surface relative grid grid-rows-[auto_1fr_auto] gap-6 overflow-hidden rounded-xl border p-6 shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-[16px] before:absolute before:top-0 before:right-0 before:left-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)] max-[1080px]:items-center max-[1080px]:px-3 max-[1080px]:py-4.5">
        <div className="border-b-line grid gap-1.5 border-b pb-4.5 max-[1080px]:flex max-[1080px]:h-12 max-[1080px]:items-center max-[1080px]:justify-center max-[1080px]:border-none max-[1080px]:p-0">
          <p className="text-brand-accent font-mono text-xs font-medium tracking-widest uppercase max-[1080px]:hidden">
            Desktop Sync Console
          </p>
          <h1 className="bg-[linear-gradient(135deg,#fff,#a5b4fc)] bg-clip-text text-[1.4rem] font-bold tracking-[-0.02em] text-transparent max-[1080px]:hidden">
            {APP_NAME}
          </h1>
          <p className={`${subtitleClass} max-[1080px]:hidden`}>
            Source: {sourceLabel}
          </p>
          <span className="hidden bg-[linear-gradient(135deg,var(--color-brand-indigo),var(--color-brand-accent))] bg-clip-text text-[1.6rem] font-extrabold text-transparent max-[1080px]:inline">
            M
          </span>
        </div>

        <nav
          className="grid content-start gap-3"
          aria-label="Workspace sections"
        >
          <button
            className={
              activeView === "overview"
                ? `${navButtonBaseClass} border-brand-indigo-border bg-[linear-gradient(90deg,var(--color-brand-indigo-bg),rgba(99,102,241,0.02))] font-semibold text-white before:scale-y-100`
                : navButtonBaseClass
            }
            onClick={() => setActiveView("overview")}
          >
            <svg
              className="group-hover:text-brand-accent size-4.5 shrink-0 opacity-70 transition-all duration-150 ease-in-out group-hover:scale-110 group-hover:opacity-100 max-[1080px]:h-5.5 max-[1080px]:w-5.5 max-[1080px]:opacity-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span className="max-[1080px]:hidden">Overview</span>
          </button>
          <button
            className={
              activeView === "sourcePaths"
                ? `${navButtonBaseClass} border-brand-indigo-border bg-[linear-gradient(90deg,var(--color-brand-indigo-bg),rgba(99,102,241,0.02))] font-semibold text-white before:scale-y-100`
                : navButtonBaseClass
            }
            onClick={() => setActiveView("sourcePaths")}
          >
            <svg
              className="group-hover:text-brand-accent size-4.5 shrink-0 opacity-70 transition-all duration-150 ease-in-out group-hover:scale-110 group-hover:opacity-100 max-[1080px]:h-5.5 max-[1080px]:w-5.5 max-[1080px]:opacity-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
            <span className="max-[1080px]:hidden">Source & Paths</span>
          </button>
          <button
            className={
              activeView === "catalog"
                ? `${navButtonBaseClass} border-brand-indigo-border bg-[linear-gradient(90deg,var(--color-brand-indigo-bg),rgba(99,102,241,0.02))] font-semibold text-white before:scale-y-100`
                : navButtonBaseClass
            }
            onClick={() => setActiveView("catalog")}
          >
            <svg
              className="group-hover:text-brand-accent size-4.5 shrink-0 opacity-70 transition-all duration-150 ease-in-out group-hover:scale-110 group-hover:opacity-100 max-[1080px]:h-5.5 max-[1080px]:w-5.5 max-[1080px]:opacity-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 8V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"></path>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
            <span className="max-[1080px]:hidden">Catalog</span>
          </button>
          <button
            className={
              activeView === "activity"
                ? `${navButtonBaseClass} border-brand-indigo-border bg-[linear-gradient(90deg,var(--color-brand-indigo-bg),rgba(99,102,241,0.02))] font-semibold text-white before:scale-y-100`
                : navButtonBaseClass
            }
            onClick={() => setActiveView("activity")}
          >
            <svg
              className="group-hover:text-brand-accent size-4.5 shrink-0 opacity-70 transition-all duration-150 ease-in-out group-hover:scale-110 group-hover:opacity-100 max-[1080px]:h-5.5 max-[1080px]:w-5.5 max-[1080px]:opacity-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span className="max-[1080px]:hidden">Activity</span>
          </button>
        </nav>

        <section className="border-t-line grid gap-2 border-t pt-6 text-[0.85rem] max-[1080px]:hidden">
          <p className={subtitleClass}>Last check: {formatTime(lastCheckAt)}</p>
          <p className={subtitleClass}>Next check: {formatTime(nextCheckAt)}</p>
          <p className={subtitleClass}>
            Runtime:{" "}
            {versionReadiness?.foundInMinecraftRootDir
              ? "configured"
              : "pending"}
          </p>
          <p className={subtitleClass}>
            Lock drift: {catalog?.hasUpdates ? "detected" : "none"}
          </p>
          <p className={subtitleClass}>
            App update:{" "}
            {launcherUpdate?.available
              ? `v${launcherUpdate.latestVersion ?? "new"} ready`
              : "none"}
          </p>
          <p className={subtitleClass}>
            Launcher version: v{launcherAppVersion ?? "--"}
          </p>
          <p className={subtitleClass}>
            Session: {sessionStatus.phase.replaceAll("_", " ")}
          </p>
          {sessionStatus.liveMinecraftDir ? (
            <p className={subtitleClass}>
              Playing dir: {sessionStatus.liveMinecraftDir}
            </p>
          ) : null}
        </section>
      </aside>

      <section className="border-line bg-bg-surface [&::-webkit-scrollbar-thumb:hover]:bg-text-muted relative grid h-full grid-rows-[auto_1fr_auto] gap-6 overflow-x-hidden overflow-y-auto rounded-xl border p-8 shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-[16px] [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] before:pointer-events-none before:absolute before:top-0 before:right-0 before:h-75 before:w-75 before:bg-[radial-gradient(circle,var(--color-brand-indigo-shadow),transparent_70%)] before:opacity-20 before:blur-2xl max-[1280px]:p-6 max-[1080px]:p-4.5 max-[920px]:p-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-(--color-line-strong) [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-track]:my-4 [&::-webkit-scrollbar-track]:bg-transparent">
        <header className="border-b-line flex animate-[slideIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-between gap-6 border-b pb-6 max-[1080px]:flex-col max-[1080px]:items-stretch">
          <div className="flex items-center gap-5">
            <div className="relative">
              {canRenderLogo ? (
                <img
                  className="bg-bg-card relative z-10 h-14 w-14 rounded-2xl border border-(--color-line-strong) object-cover shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:-rotate-2 max-[1080px]:h-10 max-[1080px]:w-10 max-[1080px]:rounded-xl"
                  src={catalog?.logoUrl}
                  alt={`${catalog?.serverName ?? SERVER_ID} logo`}
                  onError={() => markLogoAsBroken(catalog?.logoUrl)}
                />
              ) : (
                <img
                  className="bg-bg-card relative z-10 h-14 w-14 rounded-2xl border border-(--color-line-strong) object-cover shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:-rotate-2 max-[1080px]:h-10 max-[1080px]:w-10 max-[1080px]:rounded-xl"
                  src="/minerelay-logo.svg"
                  alt={`${APP_NAME} logo`}
                />
              )}
              <div className="bg-brand-indigo absolute -inset-1 z-0 rounded-lg opacity-20 blur-md" />
            </div>
            <div className="grid gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-brand-accent font-mono text-[0.65rem] font-semibold tracking-[0.15em] uppercase">
                  MineRelay
                </span>
                <span className="bg-text-muted h-1 w-1 rounded-full" />
                <span
                  className={`inline-flex items-center gap-1.5 text-[0.65rem] font-medium ${
                    launcherStreamStatus === "connected"
                      ? "text-(--color-success)"
                      : launcherStreamStatus === "retrying"
                        ? "text-warning"
                        : "text-text-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      launcherStreamStatus === "connected"
                        ? "bg-(--color-success) shadow-[0_0_6px_var(--color-success)]"
                        : launcherStreamStatus === "retrying"
                          ? "bg-warning animate-pulse"
                          : "bg-text-muted"
                    }`}
                  />
                  {launcherStreamStatus === "connected"
                    ? "Connected"
                    : launcherStreamStatus === "retrying"
                      ? "Reconnecting"
                      : "Disconnected"}
                </span>
              </div>
              <h2 className="bg-[linear-gradient(to_right,#fff_30%,#a5b4fc)] bg-clip-text text-[1.7rem] leading-[1.2] font-bold tracking-[-0.01em] text-transparent max-[1080px]:text-[1.3rem]">
                {catalog?.serverName ?? `Server ${SERVER_ID}`}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="border-line text-text-secondary rounded-full border bg-[rgba(255,255,255,0.04)] px-2.5 py-0.5 font-mono text-[0.7rem]">
                  v{launcherAppVersion ?? "--"}
                </span>
                <span className="border-line text-text-secondary rounded-full border bg-[rgba(255,255,255,0.04)] px-2.5 py-0.5 font-mono text-[0.7rem]">
                  {catalog?.loader ?? "fabric"} {catalog?.loaderVersion ?? "--"}
                </span>
                <span className="border-line text-text-secondary rounded-full border bg-[rgba(255,255,255,0.04)] px-2.5 py-0.5 font-mono text-[0.7rem]">
                  MC {catalog?.minecraftVersion ?? "--"}
                </span>
              </div>
              {sessionStatus.phase === "playing" ? (
                <p className="mt-1 flex items-center gap-1.5 text-[0.85rem] font-medium text-(--color-success)">
                  <span className="inline-block h-2 w-2 animate-[pulseGlow_2s_infinite] rounded-full bg-(--color-success) shadow-[0_0_8px_var(--color-success)]" />
                  Playing in{" "}
                  {sessionStatus.liveMinecraftDir ?? "Minecraft directory"}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            className={`${ghostButtonClass} gap-2`}
            onClick={() => void returnToMainWindow()}
            disabled={isActionBusy("window:returnMain")}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {isActionBusy("window:returnMain")
              ? "Opening..."
              : "Back to Launcher"}
          </Button>
        </header>

        <Suspense
          fallback={
            <div className={blockClass}>
              <h2 className="text-[1.4rem] font-semibold tracking-[0.01em] text-white">
                Loading View
              </h2>
              <p className={subtitleClass}>Preparing workspace section...</p>
            </div>
          }
        >
          {renderWorkspace()}
        </Suspense>
      </section>
    </main>
  );
}
