@minerelay/ui — Shared UI Component Library

Overview

@minerelay/ui is the canonical design system for all MineRelay user interfaces.

It provides a consistent set of React components, design tokens, and utility helpers shared across MineRelay front-end surfaces:
	•	Admin → Next.js web application
	•	Launcher → Vite + Tauri desktop client

All styling is implemented using Tailwind CSS v4 and design tokens defined in globals.css.

Consumers must not write custom CSS. Instead, import @minerelay/ui/globals.css once at the application root and compose the UI using the provided components and tokens.

This ensures visual consistency across all MineRelay applications.

⸻

Package Layout

packages/ui/
├── src/
│   ├── globals.css          ← Theme tokens, base styles, animations
│   ├── cn.ts                ← clsx + tailwind-merge helper
│   ├── tokens.ts            ← Pre-composed Tailwind class utilities
│   ├── types.ts             ← Shared component types (Size, BaseProps)
│   ├── index.ts             ← Barrel export for all components/utilities
│   └── components/
│       ├── alert.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── data-list.tsx
│       ├── details.tsx
│       ├── discover-item-card.tsx
│       ├── discover-modal.tsx
│       ├── empty-state.tsx
│       ├── icon-button.tsx
│       ├── info-panel.tsx
│       ├── info-row.tsx
│       ├── list-row.tsx
│       ├── modal.tsx
│       ├── modal-header.tsx
│       ├── progress-bar.tsx
│       ├── recent-mods-panel.tsx
│       ├── section-header.tsx
│       ├── select.tsx
│       ├── selectable-card.tsx
│       ├── setting-row.tsx
│       ├── stat-card.tsx
│       ├── tag.tsx
│       ├── text-input.tsx
│       ├── toast.tsx
│       ├── toggle-switch.tsx
│       └── tooltip.tsx
├── package.json
└── tsconfig.json


⸻

Design Tokens (globals.css)

All design tokens are declared inside a single @theme block in globals.css.

These tokens define the canonical visual language of MineRelay.

Token category	Examples
Backgrounds	--color-bg-base, --color-bg-card, --color-bg-input
Text	--color-text-primary, --color-text-muted, --color-text-hint
Brand	--color-brand-primary, --color-brand-accent, --color-brand-soft
Status	--color-status-ok, --color-status-error, --color-status-warn
Borders	--color-line
Radius	--radius-sm, --radius-md, --radius-lg, --radius-xl
Blur	--blur-glass
Fonts	--font-body, --font-heading, --font-mono
Spacing	--space-1 → --space-6

These tokens must be considered the single source of truth for visual values.

⸻

Token Usage Rules

All components must use canonical Tailwind token utilities derived from the variables defined in globals.css.

Correct usage

Use Tailwind token classes:

bg-brand-primary
text-text-primary
bg-bg-base
border-line

Incorrect usage

Do not reference CSS variables directly or use arbitrary Tailwind values:

bg-[var(--color-brand-primary)]
bg-[var(--color-bg-base)]
bg-[#00ffaa]

Why

Using canonical token utilities:
	•	Enforces a consistent design language
	•	Prevents uncontrolled style drift
	•	Allows global theme changes from a single source
	•	Keeps Admin and Launcher visually aligned

If a needed token does not exist, add it to globals.css first instead of introducing arbitrary values.

⸻

Styling Principles
	•	No inline styles
	•	No arbitrary Tailwind values
	•	No hardcoded colors
	•	No new CSS variables outside globals.css
	•	Prefer composition through tokens.ts or components

All UI surfaces must be built using the design system primitives.

⸻

Component Design Philosophy

Components should be designed as small, composable primitives rather than monolithic UI blocks.

Guidelines:
	•	Prefer composition over configuration
	•	Keep components focused on a single responsibility
	•	Expose minimal props
	•	Avoid deeply nested prop APIs
	•	Use composition patterns when possible

Example:

Instead of creating large configurable components, build smaller pieces:

<Card>
  <SectionHeader />
  <InfoRow />
  <Button />
</Card>

This keeps the system flexible and predictable.

⸻

When to Create a New Component

Create a new component when:
	•	The same UI pattern appears 3+ times
	•	A UI element requires shared behavior
	•	The pattern needs consistent styling across apps

Avoid creating components when:
	•	It is a one-off UI
	•	It introduces unnecessary abstraction
	•	It can be composed from existing primitives

Rule of thumb:

Prefer composition first, abstraction second.

⸻

Tailwind Layering Strategy

The UI system follows a simple layering model:

Layer 1 — Tokens

Defined in globals.css.

These represent:
	•	colors
	•	spacing
	•	typography
	•	blur
	•	radius

Layer 2 — Utility Composition

Defined in tokens.ts.

These provide reusable Tailwind class combinations such as:
	•	panel styles
	•	glass effects
	•	button states

Layer 3 — Components

Located in components/.

Components compose tokens and utilities to create reusable UI primitives.

Layer 4 — Application UI

Admin and Launcher apps consume the components.

Applications should never bypass the system by introducing their own styles.

⸻

Design System Goal

The goal of @minerelay/ui is to ensure:
	•	Visual consistency
	•	Predictable UI composition
	•	Fast UI development
	•	Easy global theming
	•	A single design language across all MineRelay products

When in doubt, extend the design system rather than bypassing it.

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

Avoid using arbitrary values for these directly in components; instead, add new tokens as needed.
If want to use a color you should do `bg-{variable}` or `text-{variable}` with a CSS variable, not an arbitrary value.
So Instead of `bg-[var(--color-brand-primary)]` must be `bg-brand-primary` and instead of `bg-[var(--color-bg-base)]` must be `bg-bg-base`. This allows us to enforce token usage and maintain design consistency. Always use CANONICAL tokens from `globals.css` in components, never hardcoded values or new custom properties. This ensures a consistent design language and makes it easy to update the theme in one place.

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

### Details
```tsx
<Details summary="Advanced options">
  <TextInput label="Token" value={token} onChange={handleChange} />
</Details>
```
Native disclosure component styled with UI token colors from `globals.css`.
Use for expandable advanced settings, technical details, and optional sections.
Supports native `open` and `onToggle`, plus `summaryClassName`, `contentClassName`, and `iconClassName` overrides.

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
