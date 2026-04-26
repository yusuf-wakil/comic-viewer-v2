import { describe, test, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSourcesStore } from '../../../src/renderer/src/store/sources'
import type { SeriesResult, SeriesDetail } from '@shared/types/source'

beforeEach(() => {
  useSourcesStore.setState({
    activeSource: 'comixto',
    results: [],
    selectedSeries: null,
    loading: false,
    error: null
  })
})

describe('sourcesStore', () => {
  test('initial state: comixto active, empty results, no selection', () => {
    const s = useSourcesStore.getState()
    expect(s.activeSource).toBe('comixto')
    expect(s.results).toEqual([])
    expect(s.selectedSeries).toBeNull()
  })

  test('setActiveSource clears results and selection', () => {
    act(() => {
      useSourcesStore.getState().setResults([{ id: '1', title: 'X', coverUrl: '' }])
      useSourcesStore.getState().setActiveSource('comixto')
    })
    const s = useSourcesStore.getState()
    expect(s.activeSource).toBe('comixto')
    expect(s.results).toEqual([])
    expect(s.selectedSeries).toBeNull()
  })

  test('setResults updates the results array', () => {
    const results: SeriesResult[] = [{ id: '1', title: 'Test', coverUrl: '' }]
    act(() => useSourcesStore.getState().setResults(results))
    expect(useSourcesStore.getState().results).toEqual(results)
  })

  test('setSelectedSeries stores series detail', () => {
    const detail: SeriesDetail = {
      id: '1',
      title: 'Test',
      coverUrl: '',
      description: '',
      genres: [],
      chapters: [{ id: 'ch1', number: '1', title: 'Chapter 1', date: '' }]
    }
    act(() => useSourcesStore.getState().setSelectedSeries(detail))
    expect(useSourcesStore.getState().selectedSeries).toEqual(detail)
  })

  test('setLoading and setError update their fields', () => {
    act(() => {
      useSourcesStore.getState().setLoading(true)
      useSourcesStore.getState().setError('network error')
    })
    expect(useSourcesStore.getState().loading).toBe(true)
    expect(useSourcesStore.getState().error).toBe('network error')
  })
})
