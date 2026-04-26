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
