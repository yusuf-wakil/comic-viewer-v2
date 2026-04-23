import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoverCard } from '../../../src/renderer/src/components/CoverCard'
import type { Comic } from '../../../src/shared/types/comic'

const comic: Comic = {
  id: '1', path: '/a.cbz', title: 'Batman #1', series: 'Batman',
  issueNumber: 1, coverPath: null, format: 'cbz', pageCount: 24,
  publisher: 'DC', year: 2022, genres: [], addedAt: Date.now()
}

describe('CoverCard', () => {
  it('renders the comic title', () => {
    render(<CoverCard comic={comic} onOpen={vi.fn()} />)
    expect(screen.getAllByText('Batman #1').length).toBeGreaterThan(0)
  })

  it('calls onOpen when clicked', async () => {
    const onOpen = vi.fn()
    render(<CoverCard comic={comic} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(comic)
  })
})
