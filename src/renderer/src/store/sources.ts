import { create } from 'zustand'
import type { SourceId, SeriesResult, SeriesDetail } from '@shared/types/source'

export interface PendingSeriesOpen {
  sourceId: SourceId
  seriesId: string
}

interface SourcesState {
  activeSource: SourceId
  results: SeriesResult[]
  selectedSeries: SeriesDetail | null
  loading: boolean
  error: string | null
  pendingSeriesOpen: PendingSeriesOpen | null
  setActiveSource: (s: SourceId) => void
  setResults: (r: SeriesResult[]) => void
  setSelectedSeries: (s: SeriesDetail | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setPendingSeriesOpen: (v: PendingSeriesOpen | null) => void
}

export const useSourcesStore = create<SourcesState>((set) => ({
  activeSource: 'comixto',
  results: [],
  selectedSeries: null,
  loading: false,
  error: null,
  pendingSeriesOpen: null,
  setActiveSource: (activeSource) => set({ activeSource, results: [], selectedSeries: null }),
  setResults: (results) => set({ results }),
  setSelectedSeries: (selectedSeries) => set({ selectedSeries }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPendingSeriesOpen: (pendingSeriesOpen) => set({ pendingSeriesOpen })
}))
