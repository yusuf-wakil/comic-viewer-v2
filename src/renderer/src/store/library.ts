import { create } from 'zustand'
import type { Comic, ReadingProgress } from '@shared/types/comic'

interface LibraryState {
  comics: Comic[]
  progress: Record<string, ReadingProgress>
  loading: boolean
  error: string | null
  setComics: (comics: Comic[]) => void
  setProgress: (comicId: string, p: ReadingProgress) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  comics: [],
  progress: {},
  loading: false,
  error: null,
  setComics: (comics) => set({ comics }),
  setProgress: (comicId, p) => set((s) => ({ progress: { ...s.progress, [comicId]: p } })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}))
