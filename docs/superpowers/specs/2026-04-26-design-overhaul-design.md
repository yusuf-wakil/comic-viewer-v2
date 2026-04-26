# Design Overhaul — OpenComic V2

**Date:** 2026-04-26
**Status:** Approved

---

## Context

The app currently has a functional but visually bare UI with no consistent color system and a library grid that shows only covers with no update information. The goal is a cleaner, more polished dark-first design with:

- A proper color system that supports user-switchable accent colors
- A redesigned home screen that leads with latest chapter releases (timestamps + multi-chapter per title, à la MangaKakalot)
- A cleaner library grid below the releases section
- A theme switcher accessible from the top nav

Login/signup and light mode are acknowledged as future work and are explicitly out of scope here.

---

## Approach

**Home Screen Overhaul First** — redesign the Library/Home screen end-to-end, baking in the color system as part of that work. Reader and Sources screens receive the color system tokens but no layout changes. This gives immediate visual payoff and a battle-tested theme system before touching secondary screens.

---

## Color System

### Dark Base Palette (fixed across all themes)

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#0d0f14` | Page background |
| `--color-surface` | `#161920` | Cards, panels |
| `--color-surface-raised` | `#1e2230` | Popovers, modals |
| `--color-border` | `#252933` | Dividers, card borders |
| `--color-text` | `#f0f2f8` | Primary text |
| `--color-text-muted` | `#8b91a0` | Secondary text, labels |
| `--color-text-subtle` | `#555b6a` | Timestamps, tertiary info |

### Accent Colors (user-selectable)

| Name | Value |
|---|---|
| Teal (default) | `#2dd4bf` |
| Indigo | `#818cf8` |
| Amber | `#fbbf24` |
| Rose | `#fb7185` |
| Lime | `#a3e635` |

Stored as `--color-accent` on the `<html>` element. Persisted to `localStorage` under the key `opencomic-accent`.

### Tailwind 4.x Wiring

Tailwind CSS 4.x does not use `tailwind.config.js` for theme extension. All custom tokens are defined in an `@theme {}` block inside `src/renderer/src/index.css`:

```css
:root {
  --color-bg: #0d0f14;
  --color-surface: #161920;
  --color-surface-raised: #1e2230;
  --color-border: #252933;
  --color-text: #f0f2f8;
  --color-text-muted: #8b91a0;
  --color-text-subtle: #555b6a;
  --color-accent: #2dd4bf; /* overwritten at runtime */
}

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

This allows standard Tailwind utilities like `bg-surface`, `text-accent`, `border-border` to work across all components.

### ThemeSwitcher Initialization (no flash)

CSS cannot read `localStorage`. To avoid a flash-of-default-color on first paint, a small inline script must run in `index.html` before React mounts:

```html
<!-- index.html <head>, before any stylesheets -->
<script>
  const accent = localStorage.getItem('opencomic-accent');
  if (accent) document.documentElement.style.setProperty('--color-accent', accent);
</script>
```

`ThemeSwitcher.tsx` handles only **writing** (updates `document.documentElement` + `localStorage`). Init/restore lives in `index.html`, not in any React component.

---

## Data Model Extension

The existing `SeriesResult` type (`src/shared/types/source.ts`) has only `latestChapter?: string` — one chapter, no timestamps. The Latest Releases section requires multiple recent chapters per title with dates.

### New type

Add to `src/shared/types/source.ts`:

```ts
export interface LatestUpdate {
  seriesId: string
  title: string
  coverUrl: string
  recentChapters: Array<{ number: string; date: string }>  // up to 3, newest first
}
```

### New IPC channel

Add `getLatestUpdates` to `src/shared/ipc/types.ts`:

```ts
getLatestUpdates: () => Promise<LatestUpdate[]>
```

Each source (`comixto.ts`, `yskcomics.ts`) implements this by fetching with `sort: 'latest'` and returning the top results with their recent chapter data. The main process handler in `src/main/ipc/handlers.ts` calls the active source's implementation.

### Fallback

If the fetch fails or returns empty, `LatestReleasesSection` shows a muted "No recent updates" message. No spinner — the library grid remains visible immediately.

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
│  │  • Ch. 57  2m    │  │  • Ch. 20  1m   │     │
│  │  • Ch. 56  5m    │  │  • Ch. 19  8m   │     │
│  │  • Ch. 55  1h    │  │  • Ch. 18  2h   │     │
│  └──────────────────┘  └──────────────────┘     │
│  (top 10 entries, vertical growth, no scroll)   │
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
- Latest Releases shows the top 10 entries, grows vertically (no horizontal scroll)
- Section headings: `text-xs tracking-widest uppercase text-text-muted font-semibold` — applied consistently to both "LATEST RELEASES" and "YOUR LIBRARY"
- Clear visual divider (`border-t border-border`) between the two sections

---

## Components

### Modified

#### `src/renderer/src/index.css`
- Add `:root {}` CSS custom properties for all color tokens
- Add `@theme {}` block wiring tokens into Tailwind
- Add inline-script note (the actual script goes in `index.html`)

#### `src/renderer/src/index.html`
- Add inline `<script>` in `<head>` to restore accent from `localStorage` before paint

#### `TopNav.tsx` (`src/renderer/src/components/TopNav.tsx`)
- Adds `<ThemeSwitcher />` icon button (palette icon, `lucide-react` or equivalent) at top-right
- Search input: pill shape (`rounded-full`), `bg-surface` background, `border-border`
- Reduced visual weight: lighter border, tighter padding

#### `CoverCard.tsx` (`src/renderer/src/components/CoverCard.tsx`)
- Progress bar: `bg-accent` instead of hardcoded color
- Title: `line-clamp-2`
- Hover: `hover:scale-[1.02] hover:shadow-lg transition-transform duration-150 ease-out`
- `rounded-xl`, tighter padding

#### `Library.tsx` (`src/renderer/src/pages/Library.tsx`)
- Renders `<LatestReleasesSection />` above the existing `<CoverGrid />`
- Section heading classes applied consistently (see above)

### New

#### `LatestReleasesCard.tsx` (`src/renderer/src/components/LatestReleasesCard.tsx`)
- Layout: cover thumbnail left (`w-11 h-16`, `rounded-md`, `object-cover`) + info column right
- Title: `font-semibold text-text`, `line-clamp-1`
- Chapter rows (up to 3): chapter number in `text-accent font-semibold text-sm` + relative timestamp in `text-text-subtle text-xs`
- "Updated X ago" summary below chapters in `text-text-subtle text-xs`
- Card: `bg-surface border border-border rounded-xl p-3`

#### `LatestReleasesSection.tsx` (`src/renderer/src/components/LatestReleasesSection.tsx`)
- On mount: calls `window.api.getLatestUpdates()` via `useIpc` hook pattern (matches existing `src/renderer/src/hooks/useIpc.ts`)
- 2-column responsive grid (`grid grid-cols-2 gap-3`)
- Shows top 10 `LatestUpdate` entries, grows vertically
- Fallback: muted "No recent updates" text if fetch fails or returns empty

#### `ThemeSwitcher.tsx` (`src/renderer/src/components/ThemeSwitcher.tsx`)
- Palette icon button in TopNav
- On click: popover with 5 accent color circles (`w-6 h-6 rounded-full`)
- Active accent: white ring border (`ring-2 ring-white`)
- On select: `document.documentElement.style.setProperty('--color-accent', value)` + `localStorage.setItem('opencomic-accent', value)`
- Does NOT handle init/restore — that belongs in `index.html`

---

## Out of Scope

- Login / signup UI (future milestone)
- Light mode (future — dark-only for now)
- Hero/featured banner (future)
- Reader or Sources layout changes (color tokens applied but no structural changes)

---

## Verification

1. **Color system:** All text, backgrounds, and borders across all screens use the new CSS token utilities (`bg-surface`, `text-accent`, etc.) — no hardcoded hex or Tailwind color-scale values in modified files
2. **Accent switching:** Toggle each of the 5 accent colors via ThemeSwitcher — progress bars, chapter numbers, and active states all update immediately without reload
3. **Persistence:** Close and reopen the app — the last selected accent color is restored with no visible flash
4. **Latest Releases:** Section appears above the library grid, showing cover + up to 3 chapters + relative timestamps per entry, capped at 10 entries
5. **Library grid:** Existing comics display correctly with updated CoverCard styling (accent progress bar, hover scale, rounded corners)
6. **TopNav:** Theme switcher icon is visible and the popover opens/closes correctly; search input renders with pill shape
7. **Reader and Sources:** Audit that text, background, and border classes in both views reference color tokens, not hardcoded values
