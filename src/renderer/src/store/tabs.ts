import { create } from 'zustand'

export interface Tab {
  id: string
  title: string
  pageUrls: string[]
  currentPage: number
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (tab: Omit<Tab, 'currentPage'>) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  updatePage: (id: string, page: number) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  openTab: (tab) => {
    const exists = get().tabs.find((t) => t.id === tab.id)
    if (exists) {
      set({ activeTabId: tab.id })
    } else {
      set((s) => ({ tabs: [...s.tabs, { ...tab, currentPage: 0 }], activeTabId: tab.id }))
    }
  },
  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeTabId = s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId }
    }),
  setActive: (id) => set({ activeTabId: id }),
  updatePage: (id, page) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, currentPage: page } : t))
    }))
}))
