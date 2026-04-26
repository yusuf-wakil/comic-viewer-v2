# Scroll Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Page/Scroll mode toggle to the comic reader, accessible from both inside the reader (top bar pill) and from a TopNav settings dropdown.

**Architecture:** Add `scrollMode` + `setScrollMode` to the Zustand reader store with `localStorage` persistence. `ReaderView` renders either the existing single-page view or a continuous vertical scroll of all pages depending on the mode. `TopNav` gets a gear icon that opens a small settings dropdown wired to the same store.

**Tech Stack:** React 19, TypeScript, Zustand 5, Vitest + React Testing Library (jsdom), Tailwind CSS, Electron (no IPC changes needed)

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/src/store/reader.ts` | Add `scrollMode: boolean`, `setScrollMode(v: boolean)`, `localStorage` load/save |
| `src/renderer/src/components/ReaderView.tsx` | New props `scrollMode`/`onToggleScrollMode`, segmented pill in top bar, scroll body with `IntersectionObserver`, conditional bottom bar |
| `src/renderer/src/pages/Reader.tsx` | Pull `scrollMode`/`setScrollMode` from store, pass to `ReaderView` |
| `src/renderer/src/components/TopNav.tsx` | Gear icon button, local `open` state, dismissible dropdown with scroll mode toggle |
| `tests/renderer/store/reader.test.ts` | New — store unit tests |
| `tests/renderer/components/ReaderView.test.tsx` | New — pill rendering, scroll body, bottom bar |
| `tests/renderer/components/TopNav.test.tsx` | New — gear button, dropdown toggle |

---

## Task 1: Extend reader store with scrollMode

**Files:**
- Modify: `src/renderer/src/store/reader.ts`
- Create: `tests/renderer/store/reader.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/store/reader.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    clear: () => { store = {} }
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { useReaderStore } from '../../../src/renderer/src/store/reader'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  useReaderStore.setState({
    comicId: null, pageUrls: [], currentPage: 0, scrollMode: false
  })
})

describe('readerStore – scrollMode', () => {
  test('defaults to false', () => {
    expect(useReaderStore.getState().scrollMode).toBe(false)
  })

  test('setScrollMode updates scrollMode', () => {
    act(() => useReaderStore.getState().setScrollMode(true))
    expect(useReaderStore.getState().scrollMode).toBe(true)
  })

  test('setScrollMode persists to localStorage', () => {
    act(() => useReaderStore.getState().setScrollMode(true))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader.scrollMode', 'true')
  })

  test('setScrollMode(false) writes false to localStorage', () => {
    act(() => useReaderStore.getState().setScrollMode(false))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader.scrollMode', 'false')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A3 "reader.test"
```

Expected: FAIL — `scrollMode` and `setScrollMode` not defined.

- [ ] **Step 3: Implement scrollMode in store**

Replace `src/renderer/src/store/reader.ts` with:

```ts
import { create } from 'zustand'

function loadScrollMode(): boolean {
  return localStorage.getItem('reader.scrollMode') === 'true'
}

interface ReaderState {
  comicId: string | null
  pageUrls: string[]
  currentPage: number
  scrollMode: boolean
  open: (comicId: string, pageUrls: string[]) => void
  close: () => void
  goTo: (page: number) => void
  next: () => void
  prev: () => void
  setScrollMode: (v: boolean) => void
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  comicId: null,
  pageUrls: [],
  currentPage: 0,
  scrollMode: loadScrollMode(),
  open: (comicId, pageUrls) => set({ comicId, pageUrls, currentPage: 0 }),
  close: () => set({ comicId: null, pageUrls: [], currentPage: 0 }),
  goTo: (page) => set({ currentPage: Math.max(0, Math.min(page, get().pageUrls.length - 1)) }),
  next: () => {
    const { currentPage, pageUrls } = get()
    if (currentPage < pageUrls.length - 1) set({ currentPage: currentPage + 1 })
  },
  prev: () => {
    const { currentPage } = get()
    if (currentPage > 0) set({ currentPage: currentPage - 1 })
  },
  setScrollMode: (v: boolean) => {
    localStorage.setItem('reader.scrollMode', String(v))
    set({ scrollMode: v })
  }
}))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A3 "reader.test"
```

Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/store/reader.ts tests/renderer/store/reader.test.ts
git commit -m "feat: add scrollMode to reader store with localStorage persistence"
```

---

## Task 2: Add segmented pill to ReaderView top bar

**Files:**
- Modify: `src/renderer/src/components/ReaderView.tsx`
- Create: `tests/renderer/components/ReaderView.test.tsx`

- [ ] **Step 1: Write failing tests for the pill**

Create `tests/renderer/components/ReaderView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReaderView } from '../../../src/renderer/src/components/ReaderView'

// Mock IntersectionObserver (not available in jsdom)
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

const baseProps = {
  pageUrls: ['comic-page://a/1', 'comic-page://a/2', 'comic-page://a/3'],
  currentPage: 0,
  title: 'Test Comic',
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onClose: vi.fn(),
  onPageChange: vi.fn(),
  scrollMode: false,
  onToggleScrollMode: vi.fn(),
}

describe('ReaderView – scroll mode pill', () => {
  it('renders "Page" and "Scroll" segments in top bar', () => {
    render(<ReaderView {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scroll' })).toBeInTheDocument()
  })

  it('"Page" segment is highlighted when scrollMode=false', () => {
    render(<ReaderView {...baseProps} scrollMode={false} />)
    expect(screen.getByRole('button', { name: 'Page' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Scroll' })).toHaveAttribute('data-active', 'false')
  })

  it('"Scroll" segment is highlighted when scrollMode=true', () => {
    render(<ReaderView {...baseProps} scrollMode={true} />)
    expect(screen.getByRole('button', { name: 'Scroll' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Page' })).toHaveAttribute('data-active', 'false')
  })

  it('calls onToggleScrollMode when clicking inactive segment', async () => {
    const onToggleScrollMode = vi.fn()
    render(<ReaderView {...baseProps} scrollMode={false} onToggleScrollMode={onToggleScrollMode} />)
    await userEvent.click(screen.getByRole('button', { name: 'Scroll' }))
    expect(onToggleScrollMode).toHaveBeenCalledTimes(1)
  })

  it('does not call onToggleScrollMode when clicking already-active segment', async () => {
    const onToggleScrollMode = vi.fn()
    render(<ReaderView {...baseProps} scrollMode={false} onToggleScrollMode={onToggleScrollMode} />)
    await userEvent.click(screen.getByRole('button', { name: 'Page' }))
    expect(onToggleScrollMode).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A5 "ReaderView.test"
```

Expected: FAIL — `scrollMode` prop not accepted / pill buttons not present.

- [ ] **Step 3: Add new props and pill to ReaderView**

In `src/renderer/src/components/ReaderView.tsx`:

1. Add to the `Props` interface:
```ts
scrollMode: boolean
onToggleScrollMode: () => void
```

2. Destructure the new props in the function signature:
```ts
export function ReaderView({ pageUrls, currentPage, title, onNext, onPrev, onClose, onPageChange, scrollMode, onToggleScrollMode }: Props) {
```

3. Replace the right-side spacer `<div style={{ width: 80 }} />` in the top bar with the segmented pill:
```tsx
{/* Scroll mode toggle pill */}
<div className="flex bg-white/10 rounded-lg overflow-hidden mr-3" style={{ fontSize: 12 }}>
  <button
    onClick={() => { if (scrollMode) onToggleScrollMode() }}
    data-active={String(!scrollMode)}
    className={`px-3 py-1 font-medium transition-colors ${!scrollMode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
  >
    Page
  </button>
  <button
    onClick={() => { if (!scrollMode) onToggleScrollMode() }}
    data-active={String(scrollMode)}
    className={`px-3 py-1 font-medium transition-colors ${scrollMode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
  >
    Scroll
  </button>
</div>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A10 "ReaderView.test"
```

Expected: pill tests PASS (5 tests).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck:web
```

Expected: type error in `Reader.tsx` only (it doesn't pass the new props yet — fixed in Task 4). All other files should be clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ReaderView.tsx tests/renderer/components/ReaderView.test.tsx
git commit -m "feat: add Page/Scroll segmented pill to ReaderView top bar"
```

---

## Task 3: Implement scroll mode content area

**Files:**
- Modify: `src/renderer/src/components/ReaderView.tsx`
- Modify: `tests/renderer/components/ReaderView.test.tsx`

- [ ] **Step 1: Write failing tests for scroll body**

Append to the `describe` block in `tests/renderer/components/ReaderView.test.tsx`:

```tsx
describe('ReaderView – scroll mode body', () => {
  it('renders all page images in scroll mode', () => {
    render(<ReaderView {...baseProps} scrollMode={true} />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3)
    expect(images[0]).toHaveAttribute('src', 'comic-page://a/1')
    expect(images[1]).toHaveAttribute('src', 'comic-page://a/2')
    expect(images[2]).toHaveAttribute('src', 'comic-page://a/3')
  })

  it('renders only current page image in page mode', () => {
    render(<ReaderView {...baseProps} scrollMode={false} currentPage={1} />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', 'comic-page://a/2')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A5 "scroll mode body"
```

Expected: FAIL — all modes still render single page.

- [ ] **Step 3: Implement scroll body in ReaderView**

In `src/renderer/src/components/ReaderView.tsx`:

1. Add new refs and state at the top of the component (after existing `useState`/`useRef` declarations):
```ts
const pageRefs = useRef<(HTMLImageElement | null)[]>([])
const [visiblePage, setVisiblePage] = useState(0)
```

2. In the existing `handleWheel` effect, add a `scrollMode` guard so the wheel handler is not attached in scroll mode:

```ts
useEffect(() => {
  if (scrollMode) return   // ← add this line
  const el = containerRef.current
  if (!el) return
  el.addEventListener('wheel', handleWheel, { passive: false })
  return () => el.removeEventListener('wheel', handleWheel)
}, [handleWheel, scrollMode])   // ← add scrollMode to deps
```

3. Add `IntersectionObserver` effect after the updated wheel effect:
```ts
useEffect(() => {
  if (!scrollMode) return
  const refs = pageRefs.current.filter(Boolean) as HTMLImageElement[]
  const ratios = new Array(refs.length).fill(0)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const i = refs.indexOf(entry.target as HTMLImageElement)
        if (i !== -1) ratios[i] = entry.intersectionRatio
      })
      // Prefer lower-indexed page on tie
      let best = 0
      for (let i = 1; i < ratios.length; i++) {
        if (ratios[i] > ratios[best]) best = i
      }
      setVisiblePage(best)
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
  )
  refs.forEach(el => observer.observe(el))
  return () => observer.disconnect()
}, [scrollMode, pageUrls])
```

4. Replace the image area content block — find the block starting with `<div ref={containerRef}` (around line 105 in the original file) and replace it and all its children up to and including its closing `</div>` with the conditional below:

```tsx
{/* Image area */}
{scrollMode ? (
  <div className="flex-1 overflow-y-auto min-h-0">
    <div className="flex flex-col items-center" style={{ gap: 8, padding: '8px 0' }}>
      {pageUrls.map((url, i) => (
        <img
          key={url}
          ref={el => { pageRefs.current[i] = el }}
          src={url}
          alt={`Page ${i + 1}`}
          draggable={false}
          style={{ width: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
        />
      ))}
    </div>
  </div>
) : (
  <div
    ref={containerRef}
    className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
    style={{ cursor: isZoomed ? (dragging ? 'grabbing' : 'grab') : 'default' }}
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    onDoubleClick={handleDoubleClick}
  >
    {/* Left arrow — hidden when zoomed */}
    {!isZoomed && (
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center z-10 group disabled:cursor-default"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isFirst ? 'opacity-0' : 'bg-black/40 group-hover:bg-black/70 opacity-80'}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
    )}

    {/* Page image */}
    <img
      key={pageUrls[currentPage]}
      src={pageUrls[currentPage]}
      alt={`Page ${currentPage + 1}`}
      draggable={false}
      style={{
        maxHeight: '100%',
        maxWidth: '100%',
        objectFit: 'contain',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        transition: dragging ? 'none' : 'transform 0.12s ease-out',
        pointerEvents: 'none',
      }}
    />

    {/* Right arrow — hidden when zoomed */}
    {!isZoomed && (
      <button
        onClick={onNext}
        disabled={isLast}
        className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center z-10 group disabled:cursor-default"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isLast ? 'opacity-0' : 'bg-black/40 group-hover:bg-black/70 opacity-80'}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
    )}

    {/* Zoom hint */}
    {isZoomed && (
      <div className="absolute bottom-3 right-3 bg-black/60 text-white/70 text-xs px-2 py-1 rounded pointer-events-none">
        {Math.round(zoom * 100)}% · double-click to reset
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A5 "scroll mode body"
```

Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ReaderView.tsx tests/renderer/components/ReaderView.test.tsx
git commit -m "feat: implement scroll mode content area with IntersectionObserver"
```

---

## Task 4: Conditional bottom bar + wire Reader.tsx

**Files:**
- Modify: `src/renderer/src/components/ReaderView.tsx`
- Modify: `src/renderer/src/pages/Reader.tsx`
- Modify: `tests/renderer/components/ReaderView.test.tsx`

- [ ] **Step 1: Write failing tests for bottom bar**

Append to `tests/renderer/components/ReaderView.test.tsx`:

```tsx
describe('ReaderView – bottom bar', () => {
  it('shows Prev/Next buttons in page mode', () => {
    render(<ReaderView {...baseProps} scrollMode={false} />)
    expect(screen.getAllByRole('button', { name: /prev/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /next/i }).length).toBeGreaterThan(0)
  })

  it('shows page counter text in scroll mode', () => {
    render(<ReaderView {...baseProps} scrollMode={true} />)
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
  })

  it('does not show Prev/Next buttons in scroll mode', () => {
    render(<ReaderView {...baseProps} scrollMode={true} />)
    // Bottom bar Prev/Next should not be present
    expect(screen.queryByRole('button', { name: '← Prev' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next →' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A5 "bottom bar"
```

Expected: FAIL — bottom bar doesn't change between modes yet.

- [ ] **Step 3: Make bottom bar conditional in ReaderView**

Replace the bottom bar section in `src/renderer/src/components/ReaderView.tsx`:

```tsx
{/* Bottom bar */}
<div className="flex items-center justify-center gap-6 px-4 py-3 bg-black/90 border-t border-white/10 flex-shrink-0">
  {scrollMode ? (
    <span className="text-white text-sm font-medium tabular-nums">
      Page {visiblePage + 1} of {pageUrls.length}
    </span>
  ) : (
    <>
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="text-white/70 hover:text-white disabled:opacity-20 text-sm font-medium transition-colors px-3 py-1 rounded hover:bg-white/10"
      >
        ← Prev
      </button>
      <span className="text-white text-sm font-medium tabular-nums min-w-[5rem] text-center">
        {currentPage + 1} / {pageUrls.length}
      </span>
      <button
        onClick={onNext}
        disabled={isLast}
        className="text-white/70 hover:text-white disabled:opacity-20 text-sm font-medium transition-colors px-3 py-1 rounded hover:bg-white/10"
      >
        Next →
      </button>
    </>
  )}
</div>
```

- [ ] **Step 4: Wire Reader.tsx**

Replace `src/renderer/src/pages/Reader.tsx` with:

```tsx
import { useCallback, useRef } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useReaderStore } from '../store/reader'
import { useTabsStore } from '../store/tabs'
import { ReaderView } from '../components/ReaderView'

interface Props {
  comicId: string
  pageUrls: string[]
  title: string
  onClose: () => void
}

export function Reader({ comicId, pageUrls, title, onClose }: Props) {
  const { invoke } = useIpc()
  const { currentPage, next, prev, scrollMode, setScrollMode } = useReaderStore()
  const updatePage = useTabsStore(s => s.updatePage)

  const invokeRef = useRef(invoke)
  invokeRef.current = invoke

  const handlePageChange = useCallback(async (page: number) => {
    updatePage(comicId, page)
    try {
      await invokeRef.current('reader:progress', { comicId, page })
    } catch (e) {
      console.error('Failed to save progress:', e)
    }
  }, [comicId, updatePage])

  return (
    <ReaderView
      pageUrls={pageUrls}
      currentPage={currentPage}
      title={title}
      onNext={next}
      onPrev={prev}
      onClose={onClose}
      onPageChange={handlePageChange}
      scrollMode={scrollMode}
      onToggleScrollMode={() => setScrollMode(!scrollMode)}
    />
  )
}
```

- [ ] **Step 5: Run all renderer tests**

```bash
npm run test:renderer -- --reporter=verbose
```

Expected: all tests PASS (including prior tasks).

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/ReaderView.tsx src/renderer/src/pages/Reader.tsx tests/renderer/components/ReaderView.test.tsx
git commit -m "feat: conditional bottom bar and wire Reader to scrollMode store"
```

---

## Task 5: TopNav gear icon + settings dropdown

**Files:**
- Modify: `src/renderer/src/components/TopNav.tsx`
- Create: `tests/renderer/components/TopNav.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/components/TopNav.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { TopNav } from '../../../src/renderer/src/components/TopNav'
import { useReaderStore } from '../../../src/renderer/src/store/reader'

const baseProps = {
  activeSection: 'library' as const,
  onSectionChange: vi.fn(),
  onAddFolder: vi.fn(),
}

beforeEach(() => {
  act(() => useReaderStore.setState({ scrollMode: false }))
})

describe('TopNav – settings dropdown', () => {
  it('renders a settings/gear button', () => {
    render(<TopNav {...baseProps} />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('dropdown is not visible initially', () => {
    render(<TopNav {...baseProps} />)
    expect(screen.queryByText('Reader Settings')).not.toBeInTheDocument()
  })

  it('clicking gear opens the dropdown', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByText('Reader Settings')).toBeInTheDocument()
  })

  it('dropdown shows Page and Scroll options', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scroll' })).toBeInTheDocument()
  })

  it('clicking Scroll in dropdown sets scrollMode to true', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Scroll' }))
    expect(useReaderStore.getState().scrollMode).toBe(true)
  })

  it('clicking outside closes the dropdown', async () => {
    render(
      <div>
        <TopNav {...baseProps} />
        <div data-testid="outside">outside</div>
      </div>
    )
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByText('Reader Settings')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('outside'))
    expect(screen.queryByText('Reader Settings')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:renderer -- --reporter=verbose 2>&1 | grep -A5 "TopNav.test"
```

Expected: FAIL — no gear button or dropdown.

- [ ] **Step 3: Implement gear icon and dropdown in TopNav**

Replace `src/renderer/src/components/TopNav.tsx` with:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useReaderStore } from '../store/reader'

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
    { id: 'labels', label: 'Labels' }
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
      className="flex items-center gap-1 pr-4 h-12 border-b border-gray-200 bg-white sticky top-0 z-10"
      style={{ paddingLeft: '80px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="font-bold text-gray-900 mr-4 text-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>OpenComic</span>

      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            activeSection === item.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          className="w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
        />
      )}

      <button
        onClick={onAddFolder}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="ml-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
      >
        + Add Folder
      </button>

      {/* Settings gear */}
      <div ref={settingsRef} className="relative ml-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          aria-label="Settings"
          onClick={() => setSettingsOpen(o => !o)}
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M13.3 6.6 12 6a4.6 4.6 0 0 0-.4-.9l.6-1.3a.7.7 0 0 0-.1-.8l-.9-.9a.7.7 0 0 0-.8-.1L9.1 2.4A4.6 4.6 0 0 0 8.2 2H8a.7.7 0 0 0-.7.5L6.7 4A4.6 4.6 0 0 0 5.8 4.4L4.5 3.8a.7.7 0 0 0-.8.1l-.9.9a.7.7 0 0 0-.1.8L3.3 7 3 8v.2c0 .3.2.6.5.7l1.2.6c.1.3.3.6.4.9l-.6 1.3a.7.7 0 0 0 .1.8l.9.9a.7.7 0 0 0 .8.1l1.3-.6c.3.1.6.3.9.4l.3 1.2c.1.3.4.5.7.5h1.3c.3 0 .6-.2.7-.5l.3-1.2c.3-.1.6-.3.9-.4l1.3.6a.7.7 0 0 0 .8-.1l.9-.9a.7.7 0 0 0 .1-.8L13 9.1A4.6 4.6 0 0 0 13.4 8l1.2-.3a.7.7 0 0 0 .4-.7V6.7a.7.7 0 0 0-.5-.7L13.3 6.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>

        {settingsOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reader Settings</div>
            <div className="h-px bg-gray-100 mx-3 my-1" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-700">Scroll mode</span>
              <div className="flex bg-gray-100 rounded-md overflow-hidden text-xs">
                <button
                  onClick={() => setScrollMode(false)}
                  data-active={String(!scrollMode)}
                  className={`px-2.5 py-1 font-medium transition-colors ${!scrollMode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Page
                </button>
                <button
                  onClick={() => setScrollMode(true)}
                  data-active={String(scrollMode)}
                  className={`px-2.5 py-1 font-medium transition-colors ${scrollMode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
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

- [ ] **Step 4: Run all renderer tests**

```bash
npm run test:renderer -- --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/TopNav.tsx tests/renderer/components/TopNav.test.tsx
git commit -m "feat: add settings gear icon and scroll mode dropdown to TopNav"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 2: Full typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit if any lint fixes were needed**

```bash
git add -p
git commit -m "chore: fix lint warnings"
```

(Skip if lint was clean.)
