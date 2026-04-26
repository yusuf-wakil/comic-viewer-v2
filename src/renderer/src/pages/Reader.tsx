import { useCallback, useRef } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useReaderStore } from '../store/reader'
import { useTabsStore } from '../store/tabs'
import { ReaderView } from '../components/ReaderView'

interface Props {
  comicId: string
  pageUrls: string[]
  title: string
  onClose: () => void
}

export function Reader({ comicId, pageUrls, title, onClose }: Props) {
  const { invoke } = useIpc()
  const { currentPage, next, prev, scrollMode, setScrollMode } = useReaderStore()
  const updatePage = useTabsStore(s => s.updatePage)

  const invokeRef = useRef(invoke)
  invokeRef.current = invoke

  const handlePageChange = useCallback(async (page: number) => {
    updatePage(comicId, page)
    try {
      await invokeRef.current('reader:progress', { comicId, page })
    } catch (e) {
      console.error('Failed to save progress:', e)
    }
  }, [comicId, updatePage])

  return (
    <ReaderView
      pageUrls={pageUrls}
      currentPage={currentPage}
      title={title}
      onNext={next}
      onPrev={prev}
      onClose={onClose}
      onPageChange={handlePageChange}
      scrollMode={scrollMode}
      onToggleScrollMode={() => setScrollMode(!scrollMode)}
    />
  )
}
