# Design Overhaul — OpenComic V2

**Date:** 2026-04-26
**Status:** Approved

---

## Context

The app currently has a functional but visually bare UI with no consistent color system and a library grid that shows only covers with no update information. The goal is a cleaner, more polished dark-first design with:

- A proper color system that supports user-switchable accent colors
- A redesigned home screen that leads with latest chapter releases (with timestamps)
- A cleaner library grid below the releases section
- A theme switcher accessible from the top nav

Login/signup and light mode are acknowledged as future work and are explicitly out of scope here.

---

## Approach

**Home Screen Overhaul First** — redesign the Library/Home screen end-to-end, baking in the color system as part of that work. Reader and Sources screens receive the color system tokens but no layout changes. This gives immediate visual payoff and a battle-tested theme system before touching secondary screens.

---

## Color System

### Dark Base Palette (fixed across all themes)

| Token                    | Value     | Usage                     |
| ------------------------ | --------- | ------------------------- |
| `--color-bg`             | `#0d0f14` | Page background           |
| `--color-surface`        | `#161920` | Cards, panels             |
| `--color-surface-raised` | `#1e2230` | Popovers, modals          |
| `--color-border`         | `#252933` | Dividers, card borders    |
| `--color-text`           | `#f0f2f8` | Primary text              |
| `--color-text-muted`     | `#8b91a0` | Secondary text, labels    |
| `--color-text-subtle`    | `#555b6a` | Timestamps, tertiary info |

### Accent Colors (user-selectable)

| Name           | Value     |
| -------------- | --------- |
| Teal (default) | `#2dd4bf` |
| Indigo         | `#818cf8` |
| Amber          | `#fbbf24` |
| Rose           | `#fb7185` |
| Lime           | `#a3e635` |

Stored as `--color-accent` on the `<html>` element. Persisted to `localStorage` under the key `opencomic-accent`.

### Tailwind 4.x Wiring

Tailwind CSS 4.x does not use `tailwind.config.js` for theme extension. All custom tokens are defined in `src/renderer/src/index.css`. The `:root` block **must appear before** the `@theme` block in the file — the self-referencing `var()` pattern only works because `:root` is resolved first:

```css
/* 1. Define concrete values on :root */
:root {
  --color-bg: #0d0f14;
  --color-surface: #161920;
  --color-surface-raised: #1e2230;
  --color-border: #252933;
  --color-text: #f0f2f8;
  --color-text-muted: #8b91a0;
  --color-text-subtle: #555b6a;
  --color-accent: #2dd4bf; /* overwritten at runtime by ThemeSwitcher */
}

/* 2. Wire into Tailwind — must come after :root */
@theme {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-surface-raised: var(--color-surface-raised);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
  --color-text-subtle: var(--color-text-subtle);
  --color-accent: var(--color-accent);
}
```

This enables utilities like `bg-surface`, `text-accent`, `border-border` across all components.

### ThemeSwitcher Initialization (no flash-of-default)

CSS cannot read `localStorage`. To avoid a visible color flash on first paint, a small inline script must run in `index.html` **before any stylesheets**:

```html
<!-- index.html <head> — before stylesheet links -->
<script>
  const accent = localStorage.getItem('opencomic-accent')
  if (accent) document.documentElement.style.setProperty('--color-accent', accent)
</script>
```

`ThemeSwitcher.tsx` handles only **writing** (updates `document.documentElement` + `localStorage`). Init/restore lives in `index.html`, not in any React component.

---

## Data Model Extension

The existing `SeriesResult` type (`src/shared/types/source.ts`) has only `latestChapter?: string` (a single chapter label, no timestamp). The Latest Releases section needs timestamps.

**Data constraint:** The comixto browse API (`/api/v2/manga?sort=latest`) returns one latest chapter number per series plus an `updated_at` timestamp. Getting a full multi-chapter history per series requires an expensive `getSeries()` call per item. For this release, `LatestUpdate` models what browse data can provide: one chapter + one timestamp. Multi-chapter history is a future enhancement.

### New type — add to `src/shared/types/source.ts`

```ts
export interface LatestUpdate {
  seriesId: string
  title: string
  coverUrl: string
  recentChapters: Array<{ number: string; date: string }> // 1 entry in practice (browse API limit)
}
```

### New IPC channel — add to `src/shared/ipc/types.ts`

```ts
'sources:getLatestUpdates': { req: { sourceId: SourceId }; res: IpcResult<LatestUpdate[]> }
```

### Main process handler — `src/main/ipc/handlers.ts`

The handler calls `provider.browse(1, 'latest')`, maps `MangaItem.updated_at` into `recentChapters`, slices to the first 10 results, and returns them. Slicing happens in the handler, not the renderer.

### Source implementations

Each source populates `recentChapters` from the data available in its browse response:

- **comixto:** map `MangaItem.last_chapter`/`latest_chapter` as `number` and `updated_at` (unix timestamp → ISO date string) as `date`
- **yskcomics:** equivalent mapping from that source's browse response fields

---

## Home/Library Layout

```
┌─────────────────────────────────────────────────┐
│  TopNav: [Logo]  [Search]          [🎨 Theme]   │
├─────────────────────────────────────────────────┤
│  TabBar (open comics)                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  LATEST RELEASES                                │
│  ┌──────────────────┐  ┌──────────────────┐     │
│  │ [cover] Title    │  │ [cover] Title    │     │
│  │  • Ch. 120  3h   │  │  • Ch. 57  1m   │     │
│  └──────────────────┘  └──────────────────┘     │
│  (top 10 entries, 2-col grid, vertical growth)  │
│                                                 │
│  ─────────────────────────────────────────      │
│                                                 │
│  YOUR LIBRARY                                   │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐           │
│  │   │ │   │ │   │ │   │ │   │ │   │           │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

- No sidebar — full-width, clean
- Latest Releases: top 10 entries, 2-column grid, grows vertically (no horizontal scroll)
- Section headings use `text-xs tracking-widest uppercase text-text-muted font-semibold` — applied identically to both "LATEST RELEASES" and "YOUR LIBRARY"
- Divider: `border-t border-border my-6`

---

## Components

### Modified

#### `src/renderer/src/index.html`

- Add inline `<script>` in `<head>` (before stylesheets) to restore accent from `localStorage`

#### `src/renderer/src/index.css`

- Add `:root {}` block with all color tokens
- Add `@theme {}` block wiring tokens into Tailwind (`:root` must precede `@theme`)

#### `TopNav.tsx` (`src/renderer/src/components/TopNav.tsx`)

- Add `<ThemeSwitcher />` icon button (palette icon) at top-right
- Search input: `rounded-full bg-surface border border-border`
- Lighter visual weight: reduce border prominence, tighten padding

#### `CoverCard.tsx` (`src/renderer/src/components/CoverCard.tsx`)

- Progress bar: `bg-accent`
- Title: `line-clamp-2`
- Hover: `hover:scale-[1.02] hover:shadow-lg transition-transform duration-150 ease-out`
- `rounded-xl`, tighter padding

#### `Library.tsx` (`src/renderer/src/pages/Library.tsx`)

- Render `<LatestReleasesSection />` above `<CoverGrid />`
- Apply shared section heading class to both section labels

### New

#### `LatestReleasesCard.tsx` (`src/renderer/src/components/LatestReleasesCard.tsx`)

- Layout: cover thumbnail left (`w-11 h-16 rounded-md object-cover flex-shrink-0`) + info column right
- Title: `font-semibold text-text line-clamp-1`
- Chapter row: chapter number in `text-accent font-semibold text-sm` + timestamp in `text-text-subtle text-xs`
- Card: `bg-surface border border-border rounded-xl p-3`

#### `LatestReleasesSection.tsx` (`src/renderer/src/components/LatestReleasesSection.tsx`)

- On mount: calls `invoke('sources:getLatestUpdates', { sourceId: activeSource })` via `useIpc` hook
- Render: `null` while loading (no spinner — library grid below remains visible)
- On data: 2-column grid (`grid grid-cols-2 gap-3`) of `<LatestReleasesCard />`
- On error or empty: single muted line "No recent updates"

#### `ThemeSwitcher.tsx` (`src/renderer/src/components/ThemeSwitcher.tsx`)

- Palette icon button in TopNav
- On click: popover (`bg-surface-raised border border-border rounded-lg p-2`) with 5 accent color circles (`w-6 h-6 rounded-full`)
- Active circle: `ring-2 ring-white ring-offset-1 ring-offset-surface-raised`
- On select: `document.documentElement.style.setProperty('--color-accent', value)` + `localStorage.setItem('opencomic-accent', value)`
- Does NOT handle init/restore — that belongs in `index.html`

---

## Out of Scope

- Login / signup UI (future milestone)
- Light mode (future — dark-only for now)
- Hero/featured banner (future)
- Multi-chapter history per series in Latest Releases (requires expensive per-series API calls — future enhancement)
- Reader or Sources layout changes (color tokens applied, no structural changes)

---

## Verification

1. **Color tokens:** In all modified files, text/background/border classes reference color tokens (`bg-surface`, `text-accent`, `border-border`, etc.) — no hardcoded hex values or Tailwind color-scale classes (e.g., `gray-800`)
2. **Accent switching:** Toggle each of the 5 accent colors via ThemeSwitcher — progress bars, chapter numbers, and active states update immediately without reload
3. **Persistence (no flash):** Close and reopen the app — the last accent color is restored with no visible color flash before React mounts
4. **Latest Releases:** Section appears above the library grid showing cover + latest chapter + timestamp per entry, capped at 10 entries; renders `null` while loading
5. **Library grid:** CoverCard renders with accent-colored progress bar, 2-line title clamp, and smooth hover scale
6. **TopNav:** ThemeSwitcher popover opens and closes correctly; search input has pill shape
7. **Reader and Sources:** Audit that all text/background/border classes in both views use color tokens, not hardcoded values
