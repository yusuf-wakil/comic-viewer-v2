import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReaderView } from '../../../src/renderer/src/components/ReaderView'

// Mock IntersectionObserver (not available in jsdom)
beforeAll(() => {
  global.IntersectionObserver = vi.fn(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }
  }) as unknown as typeof IntersectionObserver
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
  onToggleScrollMode: vi.fn()
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
    expect(screen.queryByRole('button', { name: '← Prev' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next →' })).not.toBeInTheDocument()
  })
})
