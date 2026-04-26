import { create } from 'zustand'

function loadScrollMode(): boolean {
  return localStorage.getItem('reader.scrollMode') === 'true'
}

interface ReaderState {
  comicId: string | null
  pageUrls: string[]
  currentPage: number
  scrollMode: boolean
  open: (comicId: string, pageUrls: string[]) => void
  close: () => void
  goTo: (page: number) => void
  next: () => void
  prev: () => void
  setScrollMode: (v: boolean) => void
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  comicId: null,
  pageUrls: [],
  currentPage: 0,
  scrollMode: loadScrollMode(),
  open: (comicId, pageUrls) => set({ comicId, pageUrls, currentPage: 0 }),
  close: () => set({ comicId: null, pageUrls: [], currentPage: 0 }),
  goTo: (page) => set({ currentPage: Math.max(0, Math.min(page, get().pageUrls.length - 1)) }),
  next: () => {
    const { currentPage, pageUrls } = get()
    if (currentPage < pageUrls.length - 1) set({ currentPage: currentPage + 1 })
  },
  prev: () => {
    const { currentPage } = get()
    if (currentPage > 0) set({ currentPage: currentPage - 1 })
  },
  setScrollMode: (v: boolean) => {
    localStorage.setItem('reader.scrollMode', String(v))
    set({ scrollMode: v })
  }
}))
