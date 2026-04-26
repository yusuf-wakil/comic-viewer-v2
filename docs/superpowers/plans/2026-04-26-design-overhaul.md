# Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dark-first color system with switchable accent colors, a Latest Releases home section with timestamps, a ThemeSwitcher in the nav, and updated CoverCard/TopNav styling.

**Architecture:** CSS custom properties define color tokens on `:root`; a Tailwind `@theme {}` block maps them to utilities so all components use `bg-surface`, `text-accent`, etc. A new `sources:getLatestUpdates` IPC channel fetches the top 10 recently-updated series from the active source. Three new components (`ThemeSwitcher`, `LatestReleasesCard`, `LatestReleasesSection`) are added; existing components (`TopNav`, `CoverCard`, `Library`, `Sources`) have their hardcoded gray/white Tailwind classes replaced with token utilities.

**Tech Stack:** Electron 33, React 19, TypeScript 5.9, Tailwind CSS 4.2 (`@tailwindcss/vite`), Zustand 5, Vitest + Testing Library

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/renderer/index.html` | Add CSP `unsafe-inline` + accent-restore inline script |
| Modify | `src/renderer/src/index.css` | Add `:root` tokens + `@theme {}` Tailwind wiring |
| Modify | `src/shared/types/source.ts` | Add `LatestUpdate` type + `updatedAt?` on `SeriesResult` |
| Modify | `src/shared/ipc/types.ts` | Add `sources:getLatestUpdates` channel |
| Modify | `src/main/sources/comixto.ts` | Map `updated_at` → `updatedAt` in browse results |
| Modify | `src/main/sources/yskcomics.ts` | Leave `updatedAt` undefined (API has no timestamp) |
| Modify | `src/main/ipc/handlers.ts` | Add `sources:getLatestUpdates` handler |
| **Create** | `src/renderer/src/components/ThemeSwitcher.tsx` | Accent color popover, writes to CSS var + localStorage |
| **Create** | `src/renderer/src/components/LatestReleasesCard.tsx` | Single latest-update card (cover + chapter + timestamp) |
| **Create** | `src/renderer/src/components/LatestReleasesSection.tsx` | 2-col grid of cards, fetches on mount |
| Modify | `src/renderer/src/components/TopNav.tsx` | Dark tokens + add ThemeSwitcher |
| Modify | `src/renderer/src/components/CoverCard.tsx` | Dark tokens + accent progress bar + hover transition |
| Modify | `src/renderer/src/pages/Library.tsx` | Add LatestReleasesSection + dark tokens |
| Modify | `src/renderer/src/pages/Sources.tsx` | Dark tokens (layout unchanged) |
| Modify | `src/renderer/src/components/ReaderView.tsx` | Dark tokens (layout unchanged) |
| **Create** | `tests/renderer/components/ThemeSwitcher.test.tsx` | ThemeSwitcher unit tests |
| **Create** | `tests/renderer/components/LatestReleasesCard.test.tsx` | Card unit tests |
| **Create** | `tests/renderer/components/LatestReleasesSection.test.tsx` | Section fetch + render tests |

---

## Task 1: Color System — CSS Tokens + Tailwind Wiring

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/src/index.css`

**Note:** No unit test for CSS. Verification is visual (confirmed in Task 12).

- [ ] **Step 1: Fix CSP to allow the inline theme-restore script**

  In `src/renderer/index.html`, change `script-src 'self'` to `script-src 'self' 'unsafe-inline'` (Electron apps are local — XSS from remote content is not applicable here). Also add the accent-restore script in `<head>` **before** the `<link>` tags:

  ```html
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>OpenComic</title>
      <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: comic-page: https://*.comix.to https://comix.to https://cdn.ysk-comics.com"
      />
      <script>
        const accent = localStorage.getItem('opencomic-accent');
        if (accent) document.documentElement.style.setProperty('--color-accent', accent);
      </script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **Step 2: Replace `src/renderer/src/index.css` with the full token + Tailwind wiring**

  ```css
  :root {
    --color-bg: #0d0f14;
    --color-surface: #161920;
    --color-surface-raised: #1e2230;
    --color-border: #252933;
    --color-text: #f0f2f8;
    --color-text-muted: #8b91a0;
    --color-text-subtle: #555b6a;
    --color-accent: #2dd4bf;
  }

  @import "tailwindcss";

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

  **Important:** `:root` must come before `@import "tailwindcss"` and `@theme`. The `@theme` block self-references `:root` vars — order matters.

- [ ] **Step 3: Run typecheck to confirm no breakage**

  ```bash
  npm run typecheck
  ```
  Expected: no errors (CSS changes don't affect TypeScript).

- [ ] **Step 4: Commit**

  ```bash
  git add src/renderer/index.html src/renderer/src/index.css
  git commit -m "feat: add dark color system with CSS custom properties and Tailwind theme wiring"
  ```

---

## Task 2: Data Types — LatestUpdate + IPC Channel + updatedAt on SeriesResult

**Files:**
- Modify: `src/shared/types/source.ts`
- Modify: `src/shared/ipc/types.ts`

- [ ] **Step 1: Add `updatedAt` to `SeriesResult` and add `LatestUpdate` type in `src/shared/types/source.ts`**

  Add `updatedAt?: string` to the existing `SeriesResult` interface and add the new `LatestUpdate` type below it:

  ```ts
  export interface SeriesResult {
    id: string
    title: string
    coverUrl: string
    latestChapter?: string
    rating?: number
    updatedAt?: string        // ← add this line
  }

  // Add after SeriesResult:
  export interface LatestUpdate {
    seriesId: string
    title: string
    coverUrl: string
    recentChapters: Array<{ number: string; date: string }>  // 1 entry per series (browse API limit)
  }
  ```

- [ ] **Step 2: Add the IPC channel in `src/shared/ipc/types.ts`**

  Add after `'sources:browse'`:

  ```ts
  'sources:getLatestUpdates': { req: { sourceId: SourceId };             res: IpcResult<LatestUpdate[]> }
  ```

  Also add `LatestUpdate` to the import at the top:

  ```ts
  import type { Comic, PageUrl, ReadingProgress } from '../types/comic'
  import type { SourceId, BrowseSort, SeriesResult, SeriesDetail, LatestUpdate } from '../types/source'
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  npm run typecheck
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/types/source.ts src/shared/ipc/types.ts
  git commit -m "feat: add LatestUpdate type and sources:getLatestUpdates IPC channel"
  ```

---

## Task 3: Source Data — Map updatedAt in Browse Results

**Files:**
- Modify: `src/main/sources/comixto.ts`
- Modify: `src/main/sources/yskcomics.ts`

- [ ] **Step 1: Write failing test for comixto browse returning `updatedAt`**

  In `tests/main/sources/comixto.test.ts`, add:

  ```ts
  it('browse maps updated_at unix timestamp to updatedAt ISO date string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [{
          hash_id: 'abc123',
          title: 'Test Manga',
          poster: 'https://example.com/cover.jpg',
          last_chapter: 42,
          updated_at: 1700000000,   // unix timestamp
        }]
      }),
    })
    const provider = createComixToProvider(mockFetch as Fetcher)
    const results = await provider.browse(1, 'latest')
    expect(results[0].updatedAt).toBe('2023-11-14')
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  npm run test:main -- --reporter=verbose 2>&1 | grep -A3 "updatedAt"
  ```
  Expected: FAIL — `updatedAt` is `undefined`.

- [ ] **Step 3: Update `comixto.ts` — map `updated_at` in both `createComixToProvider.browse` and `comixtoProvider.browse`**

  In `createComixToProvider.browse` (around line 351), change the return mapping:

  ```ts
  return items.map(m => {
    const latestNum = m.last_chapter ?? m.latest_chapter ?? m.chapter
    const updatedRaw = m.updated_at
    const updatedAt = updatedRaw != null
      ? (typeof updatedRaw === 'number'
          ? new Date(updatedRaw * 1000).toISOString().slice(0, 10)
          : String(updatedRaw).slice(0, 10))
      : undefined
    return {
      id: m.hash_id ?? m.id ?? '',
      title: m.title,
      coverUrl: posterUrl(m.poster),
      latestChapter: latestNum != null ? `Ch. ${latestNum}` : undefined,
      rating: (m.rating ?? m.score) != null ? parseFloat(String(m.rating ?? m.score)) : undefined,
      updatedAt,
    }
  }).filter(m => m.id)
  ```

  Apply the same change to `comixtoProvider.browse` (around line 419).

- [ ] **Step 4: yskcomics — no change needed** (browse already returns `mapComic` which doesn't have `updated_at`; `updatedAt` will be `undefined`, which is fine)

- [ ] **Step 5: Run tests**

  ```bash
  npm run test:main -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|updatedAt"
  ```
  Expected: PASS.

- [ ] **Step 6: Typecheck**

  ```bash
  npm run typecheck
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/main/sources/comixto.ts src/main/sources/yskcomics.ts tests/main/sources/comixto.test.ts
  git commit -m "feat: map updated_at to updatedAt in comixto browse results"
  ```

---

## Task 4: IPC Handler — sources:getLatestUpdates

**Files:**
- Modify: `src/main/ipc/handlers.ts`

- [ ] **Step 1: Add the handler in `src/main/ipc/handlers.ts`**

  Add after the `'sources:browse'` handler (around line 138):

  ```ts
  handle('sources:getLatestUpdates', async (_e, { sourceId }) => {
    try {
      const results = await get(sourceId).browse(1, 'latest')
      const updates: LatestUpdate[] = results.slice(0, 10).map(r => ({
        seriesId: r.id,
        title: r.title,
        coverUrl: r.coverUrl,
        recentChapters: r.latestChapter
          ? [{ number: r.latestChapter, date: r.updatedAt ?? '' }]
          : [],
      }))
      return { ok: true, data: updates }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
  ```

  Add `LatestUpdate` to the import at the top of `handlers.ts`:

  ```ts
  import type { IpcChannels } from '@shared/ipc/types'
  import type { Fetcher, LatestUpdate } from '@shared/types/source'
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  npm run typecheck
  ```
  Expected: no errors — `LatestUpdate` and the new channel are now in scope.

- [ ] **Step 3: Commit**

  ```bash
  git add src/main/ipc/handlers.ts
  git commit -m "feat: add sources:getLatestUpdates IPC handler"
  ```

---

## Task 5: ThemeSwitcher Component

**Files:**
- Create: `src/renderer/src/components/ThemeSwitcher.tsx`
- Create: `tests/renderer/components/ThemeSwitcher.test.tsx`

- [ ] **Step 1: Write failing tests**

  Create `tests/renderer/components/ThemeSwitcher.test.tsx`:

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import userEvent from '@testing-library/user-event'
  import { ThemeSwitcher } from '../../../src/renderer/src/components/ThemeSwitcher'

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--color-accent')
  })

  describe('ThemeSwitcher', () => {
    it('renders a "Change theme" button', () => {
      render(<ThemeSwitcher />)
      expect(screen.getByRole('button', { name: /change theme/i })).toBeInTheDocument()
    })

    it('popover is not visible initially', () => {
      render(<ThemeSwitcher />)
      expect(screen.queryByRole('button', { name: /teal/i })).not.toBeInTheDocument()
    })

    it('clicking the button opens the accent color popover', async () => {
      render(<ThemeSwitcher />)
      await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
      expect(screen.getByRole('button', { name: /teal/i })).toBeInTheDocument()
    })

    it('selecting an accent color sets the CSS custom property', async () => {
      render(<ThemeSwitcher />)
      await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
      await userEvent.click(screen.getByRole('button', { name: /indigo/i }))
      expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#818cf8')
    })

    it('selecting an accent color saves it to localStorage', async () => {
      render(<ThemeSwitcher />)
      await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
      await userEvent.click(screen.getByRole('button', { name: /amber/i }))
      expect(localStorage.getItem('opencomic-accent')).toBe('#fbbf24')
    })

    it('selecting an accent color closes the popover', async () => {
      render(<ThemeSwitcher />)
      await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
      await userEvent.click(screen.getByRole('button', { name: /rose/i }))
      expect(screen.queryByRole('button', { name: /teal/i })).not.toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "ThemeSwitcher|PASS|FAIL"
  ```
  Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `ThemeSwitcher.tsx`**

  Create `src/renderer/src/components/ThemeSwitcher.tsx`:

  ```tsx
  import { useState, useRef, useEffect } from 'react'

  const ACCENTS = [
    { name: 'Teal',   value: '#2dd4bf' },
    { name: 'Indigo', value: '#818cf8' },
    { name: 'Amber',  value: '#fbbf24' },
    { name: 'Rose',   value: '#fb7185' },
    { name: 'Lime',   value: '#a3e635' },
  ]

  function getCurrentAccent(): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent').trim() || '#2dd4bf'
  }

  export function ThemeSwitcher() {
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(getCurrentAccent)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!open) return
      function handleClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    function selectAccent(value: string) {
      document.documentElement.style.setProperty('--color-accent', value)
      localStorage.setItem('opencomic-accent', value)
      setActive(value)
      setOpen(false)
    }

    return (
      <div ref={ref} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          type="button"
          aria-label="Change theme"
          onClick={() => setOpen(o => !o)}
          className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 1.5C8 1.5 5 4 5 8s3 6.5 3 6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-surface-raised border border-border rounded-lg p-2 flex gap-1.5 shadow-lg z-50">
            {ACCENTS.map(({ name, value }) => (
              <button
                key={value}
                type="button"
                aria-label={name}
                onClick={() => selectAccent(value)}
                style={{ backgroundColor: value }}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                  active === value ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-raised' : ''
                }`}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 4: Run tests**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "ThemeSwitcher|PASS|FAIL"
  ```
  Expected: all ThemeSwitcher tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/src/components/ThemeSwitcher.tsx tests/renderer/components/ThemeSwitcher.test.tsx
  git commit -m "feat: add ThemeSwitcher component with 5 accent colors"
  ```

---

## Task 6: LatestReleasesCard Component

**Files:**
- Create: `src/renderer/src/components/LatestReleasesCard.tsx`
- Create: `tests/renderer/components/LatestReleasesCard.test.tsx`

- [ ] **Step 1: Write failing tests**

  Create `tests/renderer/components/LatestReleasesCard.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { LatestReleasesCard } from '../../../src/renderer/src/components/LatestReleasesCard'
  import type { LatestUpdate } from '../../../src/shared/types/source'

  const update: LatestUpdate = {
    seriesId: 'abc',
    title: 'Solo Leveling',
    coverUrl: 'https://example.com/cover.jpg',
    recentChapters: [{ number: 'Ch. 201', date: '2024-03-01' }],
  }

  describe('LatestReleasesCard', () => {
    it('renders the series title', () => {
      render(<LatestReleasesCard update={update} />)
      expect(screen.getByText('Solo Leveling')).toBeInTheDocument()
    })

    it('renders the chapter number', () => {
      render(<LatestReleasesCard update={update} />)
      expect(screen.getByText('Ch. 201')).toBeInTheDocument()
    })

    it('renders the chapter date', () => {
      render(<LatestReleasesCard update={update} />)
      expect(screen.getByText('2024-03-01')).toBeInTheDocument()
    })

    it('renders a cover image when coverUrl is provided', () => {
      render(<LatestReleasesCard update={update} />)
      expect(screen.getByRole('img', { name: 'Solo Leveling' })).toBeInTheDocument()
    })

    it('renders a placeholder when no chapters', () => {
      render(<LatestReleasesCard update={{ ...update, recentChapters: [] }} />)
      expect(screen.queryByText('Ch. 201')).not.toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "LatestReleasesCard|PASS|FAIL"
  ```
  Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `LatestReleasesCard.tsx`**

  Create `src/renderer/src/components/LatestReleasesCard.tsx`:

  ```tsx
  import type { LatestUpdate } from '@shared/types/source'

  interface Props {
    update: LatestUpdate
  }

  export function LatestReleasesCard({ update }: Props) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 flex gap-3">
        <div className="w-11 h-16 flex-shrink-0 rounded-md overflow-hidden bg-border">
          {update.coverUrl ? (
            <img
              src={update.coverUrl}
              alt={update.title}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text text-sm line-clamp-1 mb-1">{update.title}</p>
          {update.recentChapters.map((ch, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-accent font-semibold text-xs">{ch.number}</span>
              <span className="text-text-subtle text-xs">{ch.date}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Run tests**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "LatestReleasesCard|PASS|FAIL"
  ```
  Expected: all PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/src/components/LatestReleasesCard.tsx tests/renderer/components/LatestReleasesCard.test.tsx
  git commit -m "feat: add LatestReleasesCard component"
  ```

---

## Task 7: LatestReleasesSection Component

**Files:**
- Create: `src/renderer/src/components/LatestReleasesSection.tsx`
- Create: `tests/renderer/components/LatestReleasesSection.test.tsx`

- [ ] **Step 1: Write failing tests**

  Create `tests/renderer/components/LatestReleasesSection.test.tsx`:

  ```tsx
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { render, screen, waitFor } from '@testing-library/react'
  import { LatestReleasesSection } from '../../../src/renderer/src/components/LatestReleasesSection'
  import type { LatestUpdate } from '../../../src/shared/types/source'

  const mockUpdates: LatestUpdate[] = [
    { seriesId: '1', title: 'Solo Leveling', coverUrl: '', recentChapters: [{ number: 'Ch. 201', date: '2024-03-01' }] },
    { seriesId: '2', title: 'Jujutsu Kaisen', coverUrl: '', recentChapters: [{ number: 'Ch. 265', date: '2024-02-28' }] },
  ]

  beforeEach(() => {
    window.ipc = {
      invoke: vi.fn().mockResolvedValue({ ok: true, data: mockUpdates }),
    } as unknown as typeof window.ipc
  })

  describe('LatestReleasesSection', () => {
    it('renders null while loading (no spinner visible)', () => {
      window.ipc = {
        invoke: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      } as unknown as typeof window.ipc
      const { container } = render(<LatestReleasesSection sourceId="comixto" />)
      expect(container.firstChild).toBeNull()
    })

    it('renders a card for each update after fetch resolves', async () => {
      render(<LatestReleasesSection sourceId="comixto" />)
      await waitFor(() => expect(screen.getByText('Solo Leveling')).toBeInTheDocument())
      expect(screen.getByText('Jujutsu Kaisen')).toBeInTheDocument()
    })

    it('renders "No recent updates" when fetch returns empty array', async () => {
      window.ipc = {
        invoke: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      } as unknown as typeof window.ipc
      render(<LatestReleasesSection sourceId="comixto" />)
      await waitFor(() => expect(screen.getByText('No recent updates')).toBeInTheDocument())
    })

    it('renders "No recent updates" on fetch error', async () => {
      window.ipc = {
        invoke: vi.fn().mockResolvedValue({ ok: false, error: 'Network error' }),
      } as unknown as typeof window.ipc
      render(<LatestReleasesSection sourceId="comixto" />)
      await waitFor(() => expect(screen.getByText('No recent updates')).toBeInTheDocument())
    })

    it('calls sources:getLatestUpdates with the provided sourceId', async () => {
      render(<LatestReleasesSection sourceId="yskcomics" />)
      await waitFor(() => screen.getByText('Solo Leveling'))
      expect(window.ipc.invoke).toHaveBeenCalledWith(
        'sources:getLatestUpdates',
        { sourceId: 'yskcomics' }
      )
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "LatestReleasesSection|PASS|FAIL"
  ```
  Expected: FAIL.

- [ ] **Step 3: Implement `LatestReleasesSection.tsx`**

  Create `src/renderer/src/components/LatestReleasesSection.tsx`:

  ```tsx
  import { useEffect, useState } from 'react'
  import { useIpc } from '../hooks/useIpc'
  import { LatestReleasesCard } from './LatestReleasesCard'
  import type { LatestUpdate } from '@shared/types/source'
  import type { SourceId } from '@shared/types/source'

  interface Props {
    sourceId: SourceId
  }

  export function LatestReleasesSection({ sourceId }: Props) {
    const { invoke } = useIpc()
    const [updates, setUpdates] = useState<LatestUpdate[] | null>(null)

    useEffect(() => {
      let cancelled = false
      invoke('sources:getLatestUpdates', { sourceId })
        .then(data => { if (!cancelled) setUpdates(data) })
        .catch(() => { if (!cancelled) setUpdates([]) })
      return () => { cancelled = true }
    }, [sourceId])

    if (updates === null) return null

    return (
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
          Latest Releases
        </h2>
        {updates.length === 0 ? (
          <p className="text-text-subtle text-sm">No recent updates</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {updates.map(u => <LatestReleasesCard key={u.seriesId} update={u} />)}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 4: Run tests**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "LatestReleasesSection|PASS|FAIL"
  ```
  Expected: all PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/src/components/LatestReleasesSection.tsx tests/renderer/components/LatestReleasesSection.test.tsx
  git commit -m "feat: add LatestReleasesSection — fetches and renders latest updates on mount"
  ```

---

## Task 8: Update TopNav — Dark Tokens + ThemeSwitcher

**Files:**
- Modify: `src/renderer/src/components/TopNav.tsx`
- Modify: `tests/renderer/components/TopNav.test.tsx`

The existing TopNav tests check for a Settings button (aria-label "Settings"). ThemeSwitcher adds a separate "Change theme" button. The existing tests still pass as long as we keep the Settings button with the same aria-label.

- [ ] **Step 1: Run existing TopNav tests to confirm they currently pass**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "TopNav|PASS|FAIL"
  ```
  Expected: all PASS.

- [ ] **Step 2: Add a test for ThemeSwitcher presence in TopNav**

  Append to `tests/renderer/components/TopNav.test.tsx`:

  ```ts
  describe('TopNav – theme switcher', () => {
    it('renders a "Change theme" button', () => {
      render(<TopNav {...baseProps} />)
      expect(screen.getByRole('button', { name: /change theme/i })).toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 3: Run tests — expect the new test to fail**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "Change theme|PASS|FAIL"
  ```
  Expected: FAIL — ThemeSwitcher not in TopNav yet.

- [ ] **Step 4: Rewrite `TopNav.tsx` with dark tokens and ThemeSwitcher**

  Replace the full file content with:

  ```tsx
  import { useState, useEffect, useRef } from 'react'
  import { useReaderStore } from '../store/reader'
  import { ThemeSwitcher } from './ThemeSwitcher'

  interface Props {
    activeSection: 'library' | 'sources' | 'tracking' | 'labels'
    onSectionChange: (s: Props['activeSection']) => void
    onSearch?: (query: string) => void
    onAddFolder: () => void
  }

  export function TopNav({ activeSection, onSectionChange, onSearch, onAddFolder }: Props) {
    const [settingsOpen, setSettingsOpen] = useState(false)
    const settingsRef = useRef<HTMLDivElement>(null)
    const { scrollMode, setScrollMode } = useReaderStore()

    const navItems: Array<{ id: Props['activeSection']; label: string }> = [
      { id: 'library', label: 'Library' },
      { id: 'sources', label: 'Sources' },
      { id: 'tracking', label: 'Tracking' },
      { id: 'labels', label: 'Labels' },
    ]

    useEffect(() => {
      if (!settingsOpen) return
      function handleClick(e: MouseEvent) {
        if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
          setSettingsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [settingsOpen])

    return (
      <nav
        className="flex items-center gap-1 pr-4 h-12 border-b border-border bg-surface sticky top-0 z-10"
        style={{ paddingLeft: '80px', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span
          className="font-bold text-text mr-4 text-sm"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          OpenComic
        </span>

        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeSection === item.id
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:text-text hover:bg-surface-raised'
            }`}
          >
            {item.label}
          </button>
        ))}

        <div className="flex-1" />

        {onSearch && (
          <input
            type="search"
            placeholder="Search..."
            onChange={e => onSearch(e.target.value)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="w-48 px-3 py-1.5 text-sm border border-border rounded-full bg-surface text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        )}

        <button
          onClick={onAddFolder}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="ml-2 px-3 py-1.5 text-sm font-medium text-text-muted border border-border rounded-md hover:bg-surface-raised hover:text-text transition-colors"
        >
          + Add Folder
        </button>

        <ThemeSwitcher />

        {/* Settings gear */}
        <div ref={settingsRef} className="relative ml-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(o => !o)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13.3 6.6 12 6a4.6 4.6 0 0 0-.4-.9l.6-1.3a.7.7 0 0 0-.1-.8l-.9-.9a.7.7 0 0 0-.8-.1L9.1 2.4A4.6 4.6 0 0 0 8.2 2H8a.7.7 0 0 0-.7.5L6.7 4A4.6 4.6 0 0 0 5.8 4.4L4.5 3.8a.7.7 0 0 0-.8.1l-.9.9a.7.7 0 0 0-.1.8L3.3 7 3 8v.2c0 .3.2.6.5.7l1.2.6c.1.3.3.6.4.9l-.6 1.3a.7.7 0 0 0 .1.8l.9.9a.7.7 0 0 0 .8.1l1.3-.6c.3.1.6.3.9.4l.3 1.2c.1.3.4.5.7.5h1.3c.3 0 .6-.2.7-.5l.3-1.2c.3-.1.6-.3.9-.4l1.3.6a.7.7 0 0 0 .8-.1l.9-.9a.7.7 0 0 0 .1-.8L13 9.1A4.6 4.6 0 0 0 13.4 8l1.2-.3a.7.7 0 0 0 .4-.7V6.7a.7.7 0 0 0-.5-.7L13.3 6.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised border border-border rounded-lg shadow-lg z-50 py-2">
              <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Reader Settings
              </div>
              <div className="h-px bg-border mx-3 my-1" />
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-text">Scroll mode</span>
                <div className="flex bg-bg rounded-md overflow-hidden text-xs border border-border">
                  <button
                    type="button"
                    onClick={() => { setScrollMode(false); setSettingsOpen(false) }}
                    data-active={String(!scrollMode)}
                    className={`px-2.5 py-1 font-medium transition-colors ${!scrollMode ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'}`}
                  >
                    Page
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScrollMode(true); setSettingsOpen(false) }}
                    data-active={String(scrollMode)}
                    className={`px-2.5 py-1 font-medium transition-colors ${scrollMode ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'}`}
                  >
                    Scroll
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    )
  }
  ```

- [ ] **Step 5: Run all TopNav tests**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "TopNav|PASS|FAIL"
  ```
  Expected: all PASS (existing + new theme test).

- [ ] **Step 6: Commit**

  ```bash
  git add src/renderer/src/components/TopNav.tsx tests/renderer/components/TopNav.test.tsx
  git commit -m "feat: update TopNav with dark tokens and ThemeSwitcher"
  ```

---

## Task 9: Update CoverCard — Dark Tokens + Hover + Accent Progress

**Files:**
- Modify: `src/renderer/src/components/CoverCard.tsx`

Existing CoverCard tests check title rendering and click handling — both still work after styling changes.

- [ ] **Step 1: Run existing CoverCard tests to confirm they pass**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "CoverCard|PASS|FAIL"
  ```
  Expected: PASS.

- [ ] **Step 2: Replace `CoverCard.tsx` with dark-token version**

  ```tsx
  import type { Comic } from '@shared/types/comic'

  interface Props {
    comic: Comic
    onOpen: (comic: Comic) => void
    progress?: number
  }

  export function CoverCard({ comic, onOpen, progress }: Props) {
    return (
      <button
        onClick={() => onOpen(comic)}
        className="group relative flex flex-col bg-surface rounded-xl overflow-hidden text-left w-full hover:scale-[1.02] hover:shadow-lg transition-transform duration-150 ease-out"
      >
        <div className="aspect-[2/3] bg-border overflow-hidden">
          {comic.coverPath ? (
            <img
              src={`comic-page://${comic.id}/cover`}
              alt={comic.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-raised">
              <span className="text-text-muted text-xs text-center px-2">{comic.title}</span>
            </div>
          )}
        </div>
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-8 left-0 right-0 h-1 bg-border">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="p-2">
          <p className="text-xs font-medium text-text line-clamp-2">{comic.title}</p>
          {comic.series && <p className="text-xs text-text-muted truncate">{comic.series}</p>}
        </div>
      </button>
    )
  }
  ```

- [ ] **Step 3: Run CoverCard tests**

  ```bash
  npm run test:renderer -- --reporter=verbose 2>&1 | grep -E "CoverCard|PASS|FAIL"
  ```
  Expected: PASS.

- [ ] **Step 4: Commit**

  ```bash
  git add src/renderer/src/components/CoverCard.tsx
  git commit -m "feat: update CoverCard with dark tokens, accent progress bar, and hover scale"
  ```

---

## Task 10: Update Library Page — Add LatestReleasesSection + Dark Tokens

**Files:**
- Modify: `src/renderer/src/pages/Library.tsx`

- [ ] **Step 1: Replace `Library.tsx` with the updated version**

  The key changes: import `LatestReleasesSection`, add it above `CoverGrid`, replace all `gray-*`/`white` Tailwind classes with token classes, use consistent section heading style.

  ```tsx
  import { useEffect, useState } from 'react'
  import { useIpc } from '../hooks/useIpc'
  import { useLibraryStore } from '../store/library'
  import { useTabsStore } from '../store/tabs'
  import { useFavoritesStore } from '../store/favorites'
  import { useSourcesStore } from '../store/sources'
  import { CoverGrid } from '../components/CoverGrid'
  import { TopNav } from '../components/TopNav'
  import { TabBar } from '../components/TabBar'
  import { LatestReleasesSection } from '../components/LatestReleasesSection'
  import type { Comic } from '@shared/types/comic'

  type Section = 'library' | 'sources' | 'tracking' | 'labels'

  interface Props {
    activeSection: Section
    onSectionChange: (s: Section) => void
    onOpenReader: (comicId: string, pageUrls: string[], title: string) => void
  }

  export function Library({ activeSection, onSectionChange, onOpenReader }: Props) {
    const { invoke } = useIpc()
    const { comics, setComics, setLoading, setError, loading } = useLibraryStore()
    const { tabs, activeTabId, openTab, closeTab, setActive } = useTabsStore()
    const { favorites, removeFavorite } = useFavoritesStore()
    const { activeSource, setPendingSeriesOpen } = useSourcesStore()
    const [search, setSearch] = useState('')

    useEffect(() => { loadLibrary() }, [])

    async function loadLibrary() {
      setLoading(true)
      try {
        const data = await invoke('library:getAll', undefined as never)
        setComics(data)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }

    async function handleAddFolder() {
      setLoading(true)
      try {
        const path = await invoke('dialog:openFolder', undefined as never)
        if (!path) return
        const data = await invoke('library:scan', { path })
        setComics(data)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }

    async function handleOpen(comic: Comic) {
      try {
        const pageUrls = await invoke('reader:open', { comicId: comic.id })
        openTab({ id: comic.id, title: comic.title, pageUrls })
        onOpenReader(comic.id, pageUrls, comic.title)
      } catch (e) {
        console.error('Failed to open comic:', e)
      }
    }

    function handleOpenFavorite(fav: typeof favorites[number]) {
      setPendingSeriesOpen({ sourceId: fav.sourceId, seriesId: fav.id })
      onSectionChange('sources')
    }

    const filtered = search
      ? comics.filter(c =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.series.toLowerCase().includes(search.toLowerCase())
        )
      : comics

    const sectionHeading = 'text-xs font-semibold text-text-muted uppercase tracking-widest'

    return (
      <div className="flex flex-col h-screen bg-bg">
        <TopNav
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onSearch={setSearch}
          onAddFolder={handleAddFolder}
        />
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={(id) => {
            const tab = tabs.find(t => t.id === id)
            if (tab) { setActive(id); onOpenReader(id, tab.pageUrls, tab.title) }
          }}
          onClose={closeTab}
        />
        <div className="flex-1 overflow-y-auto">
          {/* Latest Releases */}
          <LatestReleasesSection sourceId={activeSource} />

          {/* Divider */}
          <div className="border-t border-border my-6 mx-4" />

          {/* Starred */}
          {favorites.length > 0 && (
            <div className="px-4 pb-2">
              <h2 className={`${sectionHeading} mb-3`}>Starred</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                {favorites.map(fav => (
                  <div key={fav.id} className="relative group">
                    <button
                      onClick={() => handleOpenFavorite(fav)}
                      className="flex flex-col items-center text-center hover:opacity-80 transition-opacity w-full"
                    >
                      <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-raised mb-1">
                        {fav.coverUrl ? (
                          <img
                            src={fav.coverUrl}
                            alt={fav.title}
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs p-1 leading-tight">
                            {fav.title}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-text-muted line-clamp-2 w-full leading-tight">{fav.title}</span>
                    </button>
                    <button
                      onClick={() => removeFavorite(fav.id)}
                      title="Remove from starred"
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full items-center justify-center hidden group-hover:flex transition-all"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                        <path d="M2 2l6 6M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-4" />
            </div>
          )}

          {/* Library */}
          <div className="px-4 py-2">
            <h2 className={`${sectionHeading} mb-3`}>Your Library</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-64 text-text-subtle">Loading…</div>
          ) : (
            <CoverGrid comics={filtered} progress={{}} onOpen={handleOpen} />
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  npm run typecheck
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/renderer/src/pages/Library.tsx
  git commit -m "feat: add LatestReleasesSection to Library and apply dark tokens"
  ```

---

## Task 11: Token Cleanup — Sources.tsx + ReaderView.tsx

**Files:**
- Modify: `src/renderer/src/pages/Sources.tsx`
- Modify: `src/renderer/src/components/ReaderView.tsx`

**Token mapping** (apply to every matching class in both files):

| Old Tailwind class(es) | New token class |
|---|---|
| `bg-gray-50` | `bg-bg` |
| `bg-white` | `bg-surface` |
| `bg-gray-100` | `bg-surface-raised` |
| `border-gray-200`, `border-gray-100` | `border-border` |
| `text-gray-900`, `text-gray-800` | `text-text` |
| `text-gray-700`, `text-gray-600` | `text-text-muted` |
| `text-gray-500`, `text-gray-400` | `text-text-subtle` |
| `hover:bg-gray-50`, `hover:bg-gray-100` | `hover:bg-surface-raised` |
| `hover:text-gray-900`, `hover:text-gray-800` | `hover:text-text` |
| `divide-gray-100` | `divide-border` |
| `bg-gray-900 text-white` (active pill/tab) | `bg-accent text-bg` |
| `focus:ring-gray-900` | `focus:ring-accent/50` |
| `bg-red-50 text-red-700 border-red-200` | `bg-surface-raised border-border text-text-muted` |
| `bg-amber-50 text-amber-700 border-amber-200` | `bg-surface-raised border-border text-text-muted` |

**Leave unchanged:** `RATING_BADGE` entries (`bg-green-100`, `bg-blue-100`, `bg-orange-100`, `bg-red-100`) — these are semantic status colors, not layout tokens. The star SVG fill (`#f59e0b`) is also a semantic color and stays.

- [ ] **Step 1: Apply token mapping to `Sources.tsx`**

  Read the file, then replace every class matching the mapping table above. Pay attention to composite classnames (classes joined in template literals). The file is 444 lines — work through it section by section: outer container → source tabs → search bar → content area → series detail → chapter list.

- [ ] **Step 2: Apply token mapping to `ReaderView.tsx`**

  Apply the same mapping. The reader already uses dark colors for the reading area; focus on any toolbar or overlay elements that use `gray-*` or `white`.

- [ ] **Step 3: Verify no layout gray-* classes remain**

  ```bash
  grep -n "bg-gray\|text-gray\|border-gray\|bg-white\|hover:bg-white\|divide-gray\|focus:ring-gray" \
    src/renderer/src/pages/Sources.tsx \
    src/renderer/src/components/ReaderView.tsx
  ```
  Expected: no output (zero matches).

- [ ] **Step 4: Run all renderer tests**

  ```bash
  npm run test:renderer
  ```
  Expected: all PASS.

- [ ] **Step 5: Typecheck**

  ```bash
  npm run typecheck
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/renderer/src/pages/Sources.tsx src/renderer/src/components/ReaderView.tsx
  git commit -m "chore: apply dark color tokens across Sources and ReaderView"
  ```

---

## Task 12: Final Verification + Full Test Run

- [ ] **Step 1: Run the full test suite**

  ```bash
  npm run test
  ```
  Expected: all tests PASS across both main and renderer configs.

- [ ] **Step 2: Typecheck both targets**

  ```bash
  npm run typecheck
  ```
  Expected: no errors.

- [ ] **Step 3: Start the app and verify manually**

  ```bash
  npm run dev
  ```

  Verify in this order:
  1. App opens with dark background (`#0d0f14`) — no white flash
  2. Click the palette icon in TopNav — popover shows 5 colored circles
  3. Click each accent circle — progress bars, chapter numbers, active nav items update instantly
  4. Switch accent to Indigo, close and reopen the app — Indigo is restored, no flash
  5. Latest Releases section appears above the library grid with covers + chapter + date
  6. Library grid shows covers with rounded corners, tighter padding, hover scale effect
  7. Progress bar on any comic with progress uses the accent color
  8. Navigate to Sources — layout is unchanged, color tokens applied
  9. Open a comic and check the Reader — no white/gray backgrounds visible

- [ ] **Step 4: Commit if any cleanup needed, then open PR**

  ```bash
  git add -p   # review any final changes
  git commit -m "chore: final cleanup and verification"
  ```
