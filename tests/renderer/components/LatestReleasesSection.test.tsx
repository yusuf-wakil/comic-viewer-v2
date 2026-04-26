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
