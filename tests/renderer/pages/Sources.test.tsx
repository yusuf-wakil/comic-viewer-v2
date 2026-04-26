import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sources } from '../../../src/renderer/src/pages/Sources'
import { useSourcesStore } from '../../../src/renderer/src/store/sources'
import type { SeriesResult, SeriesDetail } from '@shared/types/source'

vi.mock('../../../src/renderer/src/hooks/useIpc', () => ({
  useIpc: () => ({
    invoke: vi.fn().mockImplementation((channel: string) => {
      if (channel === 'sources:browse') {
        return Promise.resolve([{ id: '1', title: 'One Piece', coverUrl: '' }] as SeriesResult[])
      }
      if (channel === 'sources:getSeries') {
        return Promise.resolve({
          id: '1',
          title: 'One Piece',
          coverUrl: '',
          description: 'Pirates',
          genres: ['Action'],
          chapters: [{ id: 'ch1', number: '1', title: 'Chapter 1', date: '2023-01-01' }]
        } as SeriesDetail)
      }
      if (channel === 'sources:openChapter') {
        return Promise.resolve(['comic-page://abc/0'])
      }
      return Promise.resolve([])
    })
  })
}))

function renderSources(onOpenReader = vi.fn()) {
  return render(
    <Sources activeSection="sources" onSectionChange={vi.fn()} onOpenReader={onOpenReader} />
  )
}

beforeEach(() => {
  useSourcesStore.setState({
    activeSource: 'comixto',
    results: [],
    selectedSeries: null,
    loading: false,
    error: null
  })
})

describe('Sources page', () => {
  test('renders Comix.to source tab', async () => {
    renderSources()
    expect(screen.getByText('Comix.to')).toBeInTheDocument()
  })

  test('loads and displays browse results on mount', async () => {
    renderSources()
    await waitFor(() => expect(screen.getAllByText('One Piece').length).toBeGreaterThan(0))
  })

  test('clicking a series card shows chapter list', async () => {
    renderSources()
    await waitFor(() => screen.getAllByText('One Piece'))
    fireEvent.click(screen.getAllByText('One Piece')[0])
    await waitFor(() => expect(screen.getByText('Chapter 1')).toBeInTheDocument())
  })

  test('clicking a chapter calls onOpenReader with pageUrls', async () => {
    const onOpenReader = vi.fn()
    renderSources(onOpenReader)
    await waitFor(() => screen.getAllByText('One Piece'))
    fireEvent.click(screen.getAllByText('One Piece')[0])
    await waitFor(() => screen.getByText('Chapter 1'))
    fireEvent.click(screen.getByText('Chapter 1'))
    await waitFor(() =>
      expect(onOpenReader).toHaveBeenCalledWith('ch1', ['comic-page://abc/0'], 'Ch. 1 — Chapter 1')
    )
  })

  test('Back button returns to series grid', async () => {
    renderSources()
    await waitFor(() => screen.getAllByText('One Piece'))
    fireEvent.click(screen.getAllByText('One Piece')[0])
    await waitFor(() => screen.getByText('Chapter 1'))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    await waitFor(() => expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument())
  })

  test('clicking a source tab calls setActiveSource', async () => {
    renderSources()
    fireEvent.click(screen.getByText('Comix.to'))
    expect(useSourcesStore.getState().activeSource).toBe('comixto')
  })
})
