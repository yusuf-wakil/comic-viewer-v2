import { useCallback } from 'react'
import { useReaderStore } from '../store/reader'
import { useTabsStore } from '../store/tabs'
import { useIpc } from './useIpc'

export function useReader() {
  const { invoke } = useIpc()
  const { open, close, next, prev, goTo, currentPage } = useReaderStore()
  const { openTab, updatePage } = useTabsStore()

  const openComic = useCallback(
    async (comicId: string, title: string) => {
      const pageUrls = await invoke('reader:open', { comicId })
      open(comicId, pageUrls)
      openTab({ id: comicId, title, pageUrls })
      return pageUrls
    },
    [invoke, open, openTab]
  )

  const saveProgress = useCallback(
    async (comicId: string, page: number) => {
      updatePage(comicId, page)
      try {
        await invoke('reader:progress', { comicId, page })
      } catch (e) {
        console.error('Failed to save progress:', e)
      }
    },
    [invoke, updatePage]
  )

  return { openComic, saveProgress, close, next, prev, goTo, currentPage }
}
