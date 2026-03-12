"use client";

import { useRouter } from "next/navigation";
import { Badge, Card, SectionHeader, SelectableCard } from "@minerelay/ui";
import type { CompletedOnboardingState } from "../hooks/use-onboarding-model";

const NEXT_ACTIONS = [
  {
    icon: "dns",
    title: "Connect to Server",
    description:
      "Link your managed host to sync status, server controls, and deployments.",
    href: "/servers",
  },
  {
    icon: "palette",
    title: "Create Custom Menu with FancyMenu",
    description:
      "Build a branded main menu with custom layouts, buttons, and visual themes.",
    href: "/fancy-menu",
  },
  {
    icon: "extension",
    title: "Install Mods, Shaders & Resource Packs",
    description:
      "Install and organize your content packs from Modrinth in one place.",
    href: "/assets",
  },
] as const;

type Props = {
  completed: CompletedOnboardingState | null;
  fallbackServerName: string;
};

export function StepComplete({ completed, fallbackServerName }: Props) {
  const router = useRouter();
  const serverName = completed?.displayName || fallbackServerName;
  const serverAddress = completed?.serverAddress || "Not set";
  const runtimeLabel = completed
    ? `${completed.minecraftVersion} · ${completed.loader.toUpperCase()} ${completed.loaderVersion}`
    : "Preparing runtime…";

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex flex-col items-center gap-4 py-6 text-center">
        {/* Celebratory background effect */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
          <div className="h-[200px] w-[200px] rounded-full bg-[var(--color-success-bright)]/20 blur-[60px] animate-pulse" />
        </div>

        <Badge
          tone="online"
          pulse
          className="shadow-[0_0_12px_var(--color-success-bright)]"
        >
          All Completed
        </Badge>
        <div className="flex flex-col gap-3">
          <h2 className="m-0 text-4xl sm:text-5xl font-extrabold tracking-tight text-balance text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--color-text-muted)] drop-shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
            Setup Complete
          </h2>
          <p className="m-0 max-w-2xl text-[1.0625rem] leading-7 text-[var(--color-text-secondary)] animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 fill-mode-both">
            <span className="font-bold text-[var(--color-text-primary)]">
              {serverName}
            </span>{" "}
            is ready. Pick your next step to finish server setup and launcher
            customization.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:items-start">
        <Card surface="subtle" className="gap-3 p-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-base text-success-bright"
              aria-hidden="true"
            >
              check_circle
            </span>
            <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">
              Setup Summary
            </h3>
          </div>
          <div className="grid gap-2 rounded-[var(--radius-md)] border border-line bg-surface-deep-20 p-3">
            <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Server
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-text-primary sm:text-right">
                {serverName}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Address
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-text-primary sm:text-right">
                {serverAddress}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Runtime
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-text-primary sm:text-right">
                {runtimeLabel}
              </span>
            </div>
          </div>
          <div className="flex">
            <Badge tone={completed?.fancyMenuEnabled ? "online" : "neutral"}>
              {completed?.fancyMenuEnabled
                ? "FancyMenu enabled"
                : "FancyMenu not enabled"}
            </Badge>
          </div>
        </Card>

        <div className="space-y-3">
          <SectionHeader
            icon={
              <span
                className="material-symbols-outlined text-xl"
                aria-hidden="true"
              >
                route
              </span>
            }
            title="Choose Your Next Step"
            description="You can do all three; start with the one you need right now."
          />
          <div className="grid gap-3">
            {NEXT_ACTIONS.map((action, i) => (
              <div
                key={action.href}
                className={`animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-[${(i + 1) * 100}ms]`}
              >
                <SelectableCard
                  selected={false}
                  onClick={() => router.push(action.href)}
                  className="group gap-1.5 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                  icon={
                    <span
                      className="material-symbols-outlined text-[20px] text-[var(--color-brand-primary)]"
                      aria-hidden="true"
                    >
                      {action.icon}
                    </span>
                  }
                  headerRight={
                    <span
                      className="material-symbols-outlined text-base text-[var(--color-text-muted)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-text-primary)]"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  }
                  title={action.title}
                  description={action.description}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
