import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SourceId } from '@shared/types/source'

export interface FavoriteItem {
  id: string
  title: string
  coverUrl: string
  sourceId: SourceId
}

interface FavoritesState {
  favorites: FavoriteItem[]
  addFavorite: (item: FavoriteItem) => void
  removeFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (item) => set(s => {
        const existing = s.favorites.findIndex(f => f.id === item.id)
        if (existing !== -1) {
          const next = [...s.favorites]
          next[existing] = item
          return { favorites: next }
        }
        return { favorites: [...s.favorites, item] }
      }),
      removeFavorite: (id) => set(s => ({ favorites: s.favorites.filter(f => f.id !== id) })),
      isFavorite: (id) => get().favorites.some(f => f.id === id),
    }),
    { name: 'opencomic-favorites' }
  )
)
