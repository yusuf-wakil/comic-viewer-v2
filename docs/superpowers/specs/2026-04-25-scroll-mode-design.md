# Scroll Mode Toggle — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Overview

Add a reader mode toggle letting users choose between **Page mode** (arrow-based, one page at a time) and **Scroll mode** (all chapter pages in a continuous vertical scroll). The preference is global and persists across sessions.

---

## State

**Store:** `store/reader.ts`

Add two fields to `ReaderState`:

```ts
scrollMode: boolean          // default false (page mode)
setScrollMode: (v: boolean) => void
```

**Persistence:** On init, read from `localStorage` key `reader.scrollMode` (parse as boolean, default `false`). On `setScrollMode`, write back to `localStorage`. No IPC or backend involvement.

---

## ReaderView Changes

**File:** `src/renderer/src/components/ReaderView.tsx`

### New props

```ts
scrollMode: boolean
onToggleScrollMode: () => void
```

### Top bar — segmented pill

Replace the existing right-side spacer `<div style={{ width: 80 }} />` with a segmented pill:

```
[ Page | Scroll ]
```

- Active segment is visually highlighted
- Clicking the inactive segment calls `onToggleScrollMode`
- Clicking the already-active segment is a no-op

### Content area (scroll mode: `true`)

- Renders all `pageUrls` as a vertical column of `<img>` tags
- 8px gap between pages
- Container: `overflow-y: auto`, full viewport height minus top/bottom bars
- Each image: `width: 100%`, `object-fit: contain`
- An `IntersectionObserver` watches all page images; whichever image has the greatest intersection ratio is considered `visiblePage` (local state, `number`)
- Zoom/pan is disabled — the `wheel` event listener is not attached in scroll mode

### Content area (scroll mode: `false`)

Existing single-page behavior, untouched.

### Bottom bar

| Mode        | Content                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| Page mode   | Existing: ← Prev · `{currentPage + 1} / {pageUrls.length}` · Next →      |
| Scroll mode | Centered: `Page {visiblePage + 1} of {pageUrls.length}` (no nav buttons) |

---

## Reader.tsx Changes

**File:** `src/renderer/src/pages/Reader.tsx`

Pull `scrollMode` and `setScrollMode` from `useReaderStore`. Pass down to `ReaderView`:

```tsx
<ReaderView
  ...
  scrollMode={scrollMode}
  onToggleScrollMode={() => setScrollMode(!scrollMode)}
/>
```

---

## TopNav Settings Access

**File:** `src/renderer/src/components/TopNav.tsx`

Add a gear icon button to the right side of the nav bar (after the existing "+ Add Folder" button). Clicking it opens a small dropdown panel:

```
┌──────────────────────────┐
│  Reader Settings          │
│  ────────────────────── │
│  Scroll mode  [Page|Scroll]│
└──────────────────────────┘
```

- Dropdown is dismissed by clicking outside (standard `useEffect` + `mousedown` listener on `document`)
- The toggle reads/writes `scrollMode` directly from `useReaderStore`
- Dropdown uses a `useState<boolean>` local to `TopNav` for open/close state

---

## Files Changed

| File                                         | Change                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/renderer/src/store/reader.ts`           | Add `scrollMode`, `setScrollMode`, localStorage persistence                        |
| `src/renderer/src/components/ReaderView.tsx` | Segmented pill, scroll mode content + IntersectionObserver, conditional bottom bar |
| `src/renderer/src/pages/Reader.tsx`          | Pass `scrollMode` + `onToggleScrollMode` to ReaderView                             |
| `src/renderer/src/components/TopNav.tsx`     | Gear icon + dismissible settings dropdown                                          |

No new files. No IPC changes. No new dependencies.

---

## Out of Scope

- Per-comic scroll mode memory (global only)
- Zoom/pan in scroll mode
- Reading direction (right-to-left)
- Keyboard shortcuts for mode switching
