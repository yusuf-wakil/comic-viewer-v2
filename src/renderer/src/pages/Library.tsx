import { useEffect, useState } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useLibraryStore } from '../store/library'
import { useTabsStore } from '../store/tabs'
import { useFavoritesStore } from '../store/favorites'
import { useSourcesStore } from '../store/sources'
import { CoverGrid } from '../components/CoverGrid'
import { TopNav } from '../components/TopNav'
import { TabBar } from '../components/TabBar'
import { LatestReleasesSection } from '../components/LatestReleasesSection'
import type { Comic } from '@shared/types/comic'

type Section = 'library' | 'sources' | 'tracking' | 'labels'

interface Props {
  activeSection: Section
  onSectionChange: (s: Section) => void
  onOpenReader: (comicId: string, pageUrls: string[], title: string) => void
}

export function Library({ activeSection, onSectionChange, onOpenReader }: Props) {
  const { invoke } = useIpc()
  const { comics, setComics, setLoading, setError, loading } = useLibraryStore()
  const { tabs, activeTabId, openTab, closeTab, setActive } = useTabsStore()
  const { favorites, removeFavorite } = useFavoritesStore()
  const { activeSource, setPendingSeriesOpen } = useSourcesStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadLibrary()
  }, [])

  async function loadLibrary() {
    setLoading(true)
    try {
      const data = await invoke('library:getAll', undefined as never)
      setComics(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleAddFolder() {
    setLoading(true)
    try {
      const path = await invoke('dialog:openFolder', undefined as never)
      if (!path) return
      const data = await invoke('library:scan', { path })
      setComics(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleOpen(comic: Comic) {
    try {
      const pageUrls = await invoke('reader:open', { comicId: comic.id })
      openTab({ id: comic.id, title: comic.title, pageUrls })
      onOpenReader(comic.id, pageUrls, comic.title)
    } catch (e) {
      console.error('Failed to open comic:', e)
    }
  }

  function handleOpenFavorite(fav: typeof favorites[number]) {
    setPendingSeriesOpen({ sourceId: fav.sourceId, seriesId: fav.id })
    onSectionChange('sources')
  }

  const filtered = search
    ? comics.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.series.toLowerCase().includes(search.toLowerCase()))
    : comics

  const sectionHeading = 'text-xs font-semibold text-text-muted uppercase tracking-widest'

  return (
    <div className="flex flex-col h-screen bg-bg">
      <TopNav
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        onSearch={setSearch}
        onAddFolder={handleAddFolder}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={(id) => {
          const tab = tabs.find(t => t.id === id)
          if (tab) { setActive(id); onOpenReader(id, tab.pageUrls, tab.title) }
        }}
        onClose={closeTab}
      />
      <div className="flex-1 overflow-y-auto">
        {/* Latest Releases */}
        <LatestReleasesSection sourceId={activeSource} />

        {/* Divider */}
        <div className="border-t border-border my-6 mx-4" />

        {/* Starred section */}
        {favorites.length > 0 && (
          <div className="px-4 pb-2">
            <h2 className={`${sectionHeading} mb-3`}>Starred</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {favorites.map(fav => (
                <div key={fav.id} className="relative group">
                  <button
                    onClick={() => handleOpenFavorite(fav)}
                    className="flex flex-col items-center text-center hover:opacity-80 transition-opacity w-full"
                  >
                    <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-raised mb-1">
                      {fav.coverUrl ? (
                        <img
                          src={fav.coverUrl}
                          alt={fav.title}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-subtle text-xs p-1 leading-tight">
                          {fav.title}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-text-muted line-clamp-2 w-full leading-tight">{fav.title}</span>
                  </button>
                  <button
                    onClick={() => removeFavorite(fav.id)}
                    title="Remove from starred"
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full items-center justify-center hidden group-hover:flex transition-all"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="white" aria-hidden="true">
                      <path d="M2 2l6 6M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4" />
          </div>
        )}

        {/* Library */}
        <div className="px-4 py-2">
          <h2 className={`${sectionHeading} mb-3`}>Your Library</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-text-subtle">Loading…</div>
        ) : (
          <CoverGrid comics={filtered} progress={{}} onOpen={handleOpen} />
        )}
      </div>
    </div>
  )
}
