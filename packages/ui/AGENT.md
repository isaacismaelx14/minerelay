# @minerelay/ui — Shared UI Component Library

## Overview

`@minerelay/ui` is the unified design system for MineRelay's web surfaces.
It provides React components, design tokens, and utility classes shared between
the **Admin** (Next.js) and **Launcher** (Vite + Tauri) front-ends.

All styling is Tailwind CSS v4. No custom CSS is authored by consumers —
import `@minerelay/ui/globals.css` once at the app root and use components/tokens.

---

## Package Layout

```
packages/ui/
├── src/
│   ├── globals.css          ← @theme tokens, base resets, keyframes
│   ├── cn.ts                ← clsx + tailwind-merge helper
│   ├── tokens.ts            ← pre-composed Tailwind class strings
│   ├── types.ts             ← shared component types (Size, BaseProps)
│   ├── index.ts             ← barrel export (all components, utils, types)
│   └── components/
│       ├── alert.tsx         ← Alert (error / hint / info)
│       ├── avatar.tsx        ← Avatar image/fallback with optional overlay
│       ├── badge.tsx         ← Badge tone chips
│       ├── button.tsx        ← Button (8 variants, 4 sizes, shimmer)
│       ├── card.tsx          ← Glass card panel
│       ├── data-list.tsx     ← Key-value data display
│       ├── discover-item-card.tsx ← Discover catalog card shell
│       ├── discover-modal.tsx← Compound search modal with sidebar
│       ├── empty-state.tsx   ← Icon + title + description placeholder
│       ├── icon-button.tsx   ← Compact icon-only button
│       ├── info-panel.tsx    ← Panel container with icon + optional action
│       ├── info-row.tsx      ← Label/value row for compact metadata
│       ├── list-row.tsx      ← Generic list row (leading/content/trailing)
│       ├── modal.tsx         ← Portal modal with focus trap
│       ├── modal-header.tsx  ← Modal title bar + close button
│       ├── progress-bar.tsx  ← Animated meter (determinate / indeterminate)
│       ├── recent-mods-panel.tsx ← Recent mods summary panel
│       ├── section-header.tsx← Section icon + heading + subtitle
│       ├── select.tsx        ← Labeled dropdown
│       ├── selectable-card.tsx ← Clickable selectable card option
│       ├── setting-row.tsx   ← Settings row with trailing control
│       ├── stat-card.tsx     ← Toned stats card with icon and value
│       ├── tag.tsx           ← Compact uppercase label chip
│       ├── text-input.tsx    ← Labeled text field
│       ├── toast.tsx         ← ToastProvider + useToast() hook
│       ├── toggle-switch.tsx ← Accessible toggle switch
│       └── tooltip.tsx       ← Base UI tooltip wrapper
├── package.json
└── tsconfig.json
```

---

## Design Tokens (globals.css)

All tokens live in a single `@theme` block inside `globals.css`.

| Token category | Examples |
|---|---|
| Backgrounds | `--color-bg-base`, `--color-bg-card`, `--color-bg-input` |
| Text | `--color-text-primary`, `--color-text-muted`, `--color-text-hint` |
| Brand | `--color-brand-primary`, `--color-brand-accent`, `--color-brand-soft` |
| Status | `--color-status-ok`, `--color-status-error`, `--color-status-warn` |
| Lines / borders | `--color-line` |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` |
| Blur | `--blur-glass` |
| Fonts | `--font-body`, `--font-heading`, `--font-mono` |
| Spacing | `--space-1` through `--space-6` |

Consumers should reference these via `var(--color-…)` or Tailwind's
`bg-[var(--color-bg-base)]` syntax when building custom layouts.

---

## Component Catalog

### Button
```tsx
<Button variant="primary" size="md" icon="rocket_launch">
  Launch
</Button>
```
**Variants:** `primary` | `ghost` | `outline` | `danger` | `danger-ghost` | `warn` | `success` | `flat`
**Sizes:** `xs` | `sm` | `md` | `lg`
**Features:** Shimmer sweep on hover (primary only), icon + iconRight slots, disabled state.

### IconButton
```tsx
<IconButton size="sm" icon="settings" label="Open settings" />
```

### Card
```tsx
<Card hoverable>Content here</Card>
```
**Props:** `hoverable` — enables lift + glow on hover.

### Modal
```tsx
<Modal onClose={close} wide>
  <ModalHeader title="Edit" subtitle="Change settings" onClose={close} />
  {/* content */}
</Modal>
```
Portal-based, focus-trapped, escape-to-close.
**Props:** `wide` — 1150 px layout for compound content.

### DiscoverModal
```tsx
<DiscoverModal
  title="Add Plugin"
  searchPlaceholder="Search…"
  searchQuery={q}
  onSearchQueryChange={setQ}
  onClose={close}
  sidebar={<PluginDetails />}
  footer={<Button>Install</Button>}
>
  <PluginGrid />
</DiscoverModal>
```

### Tooltip
```tsx
<Tooltip label="Copy link">
  <IconButton icon="link" label="Copy" />
</Tooltip>
```
Wraps Base UI Tooltip. Dark chrome.

### ToggleSwitch
```tsx
<ToggleSwitch enabled={val} onChange={setVal} label="Enable feature" />
```

### TextInput / Select
```tsx
<TextInput label="Name" value={v} onChange={setV} />
<Select label="Region" value={r} onChange={setR} options={regions} />
```

### Badge
```tsx
<Badge tone="online">Running</Badge>
```
**Tones:** `online` | `busy` | `offline` | `error` | `warning` | `info` | `neutral`

### Alert
```tsx
<Alert tone="error" icon="error">Something went wrong.</Alert>
```
**Tones:** `error` | `hint` | `info`

### ProgressBar
```tsx
<ProgressBar value={65} />
<ProgressBar indeterminate />
```

### Toast
```tsx
// Wrap app root:
<ToastProvider>{children}</ToastProvider>

// In any child:
const { pushToast } = useToast();
pushToast("success", "Saved!");
```

### DataList / DataItem
```tsx
<DataList>
  <DataItem label="Version" value="1.20.4" />
  <DataItem label="Seed" value="abc123" />
</DataList>
```

### SectionHeader
```tsx
<SectionHeader icon="settings" title="General" description="Core settings" />
```

### EmptyState
```tsx
<EmptyState icon="inbox" title="No items" description="Create your first item." />
```

### Avatar
```tsx
<Avatar src={profileUrl} fallback="A" size="md" />
```
**Sizes:** `sm` | `md` | `lg`
**Features:** Supports `overlay` slot for status badges and fallback letter when image is missing.

### Tag
```tsx
<Tag>beta</Tag>
```
Compact uppercase metadata chip; useful inside row/card `meta` areas.

### ListRow
```tsx
<ListRow
  leading={<Avatar fallback="M" size="sm" />}
  title="Modrinth"
  meta={<Tag>installed</Tag>}
  description="Source integration"
  trailing={<Button size="xs">Manage</Button>}
/>
```
Generic list primitive with `leading`, `meta`, and `trailing` slots.

### DiscoverItemCard
```tsx
<DiscoverItemCard
  media={<Avatar fallback="P" />}
  idLabel={<Tag>plugin</Tag>}
  title="Performance Booster"
  description="Optimize chunk loading and startup"
  footerLabel="Author"
  footerValue="MineRelay"
  actionButton={<Button size="xs">Install</Button>}
/>
```

### StatCard
```tsx
<StatCard label="Active" value={12} icon="rocket_launch" tone="emerald" />
```
**Tones:** `emerald` | `red` | `amber` | `indigo`

### InfoPanel / InfoRow
```tsx
<InfoPanel icon="info" title="Server Details" actionLabel="Edit" onAction={openEdit}>
  <InfoRow label="Version" value="1.21.1" />
  <InfoRow label="Status" value="Healthy" highlight="success" />
</InfoPanel>
```
`InfoRow.highlight`: `success` | `warning`

### RecentModsPanel
```tsx
<RecentModsPanel items={mods.slice(0, 5)} totalCount={mods.length} onViewAll={openMods} />
```
Purpose-built summary panel for recent mod entries with quick "View All" action.

### SelectableCard
```tsx
<SelectableCard
  selected={mode === "auto"}
  onClick={() => setMode("auto")}
  title="Automatic"
  description="Recommended defaults"
  headerRight={<Tag>recommended</Tag>}
/>
```
Interactive option card for selection flows.

### SettingRow
```tsx
<SettingRow
  title="Auto update"
  description="Download updates in the background"
  control={<ToggleSwitch enabled={enabled} onChange={setEnabled} />}
/>
```

---

## Utility Exports

| Export | Purpose |
|---|---|
| `cn(...inputs)` | Merge class names (clsx + tailwind-merge). Use everywhere. |
| `ui` object | Pre-composed Tailwind class strings for common patterns (panels, rows, status chips, etc.). |

---

## Adding a New Component

1. Create `src/components/<name>.tsx`.
2. Add `"use client"` at the top (required for RSC compat).
3. Export props interface and component from the file.
4. Re-export both from `src/index.ts`.
5. Run `pnpm --filter @minerelay/ui build` and verify DTS output.
6. Document the component in this file.

---

## Build

```bash
pnpm --filter @minerelay/ui build   # ESM + CJS + d.ts
pnpm --filter @minerelay/ui dev     # watch mode
```

Output lands in `dist/`. Consumers import from `@minerelay/ui`.

---

## Consuming in Apps

```ts
// In app's CSS entry (layout.tsx or main.tsx):
import "@minerelay/ui/globals.css";

// In components:
import { Button, Card, cn, ui } from "@minerelay/ui";
```

The `@minerelay/ui` path alias is configured in `tsconfig.base.json`.

---

## Design Principles

1. **Dark-first** — all tokens assume dark backgrounds; light mode is not planned.
2. **Glass aesthetic** — cards use 16 px blur and semi-transparent backgrounds.
3. **Brand gradient** — Indigo → Cyan used in primary buttons, headings, active states.
4. **Reduced motion** — all animations respect `prefers-reduced-motion`.
5. **Accessibility** — ARIA roles, keyboard navigation, focus trapping in modals.
6. **No custom CSS in consumers** — everything is tokens + Tailwind utilities.
