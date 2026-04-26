import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SourceId } from '@shared/types/source'

export interface HistoryItem {
  id: string
  title: string
  coverUrl: string
  sourceId: SourceId | 'local'
  lastReadAt: number
}

interface HistoryState {
  history: HistoryItem[]
  addHistory: (item: Omit<HistoryItem, 'lastReadAt'>) => void
  removeHistory: (id: string) => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      history: [],
      addHistory: (item) =>
        set(s => ({
          history: [
            { ...item, lastReadAt: Date.now() },
            ...s.history.filter(h => h.id !== item.id),
          ].slice(0, 50),
        })),
      removeHistory: (id) => set(s => ({ history: s.history.filter(h => h.id !== id) })),
    }),
    { name: 'opencomic-history' }
  )
)
