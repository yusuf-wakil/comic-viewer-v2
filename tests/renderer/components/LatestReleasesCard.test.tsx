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
