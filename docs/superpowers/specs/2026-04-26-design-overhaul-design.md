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

**Home Screen Overhaul First** — redesign the Library/Home screen end-to-end, baking in the color system as part of that work. Reader and Sources screens receive the color system but no layout changes. This gives immediate visual payoff and a battle-tested theme system before touching secondary screens.

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

Stored as `--color-accent` on the `<html>` element. Persisted to `localStorage` under the key `opencomic-accent`. All Tailwind accent utilities reference this variable.

### Tailwind Wiring

`index.css` defines the CSS custom properties on `:root`. The Tailwind config extends the theme to map `accent` → `var(--color-accent)`, `surface` → `var(--color-surface)`, etc., so standard utility classes like `bg-surface`, `text-accent`, `border-border` work across all components.

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
- Section headings use `text-text-muted` small caps style
- Clear visual divider between the two sections

---

## Components

### Modified

#### `TopNav.tsx`
- Adds `ThemeSwitcher` icon button (palette icon) in the top-right
- Search input gets a pill shape on `bg-surface` background
- Reduced visual weight — lighter borders, cleaner spacing

#### `CoverCard.tsx`
- Tighter padding, `rounded-xl`
- Progress bar uses `bg-accent` instead of a hardcoded color
- Title truncates at 2 lines (`line-clamp-2`)
- Hover: subtle lift with `shadow-lg` and `scale-[1.02]` transition

#### `Library.tsx`
- Renders `LatestReleasesSection` above the existing `CoverGrid`
- Section heading styles standardized

### New

#### `LatestReleasesCard.tsx`
- Layout: cover thumbnail (left, fixed 44×60px) + info column (right)
- Info column: title (bold), then a list of up to 3 recent chapters
- Each chapter row: chapter number in `text-accent` + relative timestamp in `text-text-subtle`
- "Updated X ago" summary line at the bottom in `text-text-subtle`
- Card background: `bg-surface`, border: `border-border`, `rounded-xl`

#### `LatestReleasesSection.tsx`
- Wraps a 2-column responsive grid of `LatestReleasesCard`
- Section heading: "LATEST RELEASES" in small-caps muted style
- Data sourced from the existing sources store (Zustand `sources.ts`)

#### `ThemeSwitcher.tsx`
- Small palette icon button in TopNav
- On click: popover with 5 colored circle buttons (one per accent color)
- Active accent has a white ring border
- On select: sets `--color-accent` on `document.documentElement`, writes to `localStorage`
- Reads saved preference on app init in `index.css` or a root-level effect

---

## Out of Scope

- Login / signup UI (future milestone)
- Light mode (future — dark-only for now)
- Hero/featured banner (future)
- Reader or Sources layout changes (color system applied but no structural changes)

---

## Verification

1. **Color system:** Toggle each of the 5 accent colors via ThemeSwitcher — all accent-colored elements (progress bars, chapter numbers, active states) update immediately without reload
2. **Persistence:** Close and reopen the app — the last selected accent color is restored
3. **Latest Releases:** Section appears above the library grid on the home screen, showing cover + multiple chapters + timestamps per entry
4. **Library grid:** Existing comics display correctly with the updated CoverCard styling
5. **TopNav:** Theme switcher icon is visible and functional; search input renders cleanly
6. **No regressions:** Reader view and Sources view render correctly with the new color tokens applied
