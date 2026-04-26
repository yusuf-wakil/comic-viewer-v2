import { useEffect, useState, useRef } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useSourcesStore } from '../store/sources'
import { useFavoritesStore } from '../store/favorites'
import { useHistoryStore } from '../store/history'
import { LatestReleasesSection } from '../components/LatestReleasesSection'
import { TopNav } from '../components/TopNav'
import type { SourceId, SeriesDetail, ContentRating, BrowseSort } from '@shared/types/source'

type Section = 'library' | 'sources' | 'tracking' | 'labels'

interface Props {
  activeSection: Section
  onSectionChange: (s: Section) => void
  onOpenReader: (comicId: string, pageUrls: string[], title: string) => void
}

const SOURCE_LABELS: Record<SourceId, string> = {
  comixto: 'Comix.to',
  yskcomics: 'YSK Comics'
}

const ALL_SOURCES: SourceId[] = ['comixto', 'yskcomics']

const RATING_BADGE: Record<ContentRating, { label: string; className: string }> = {
  'all-ages': { label: 'All Ages', className: 'bg-green-100 text-green-700' },
  'teen':     { label: 'Teen',     className: 'bg-blue-100 text-blue-700' },
  'mature':   { label: 'Mature',   className: 'bg-orange-100 text-orange-700' },
  'adult':    { label: '18+',      className: 'bg-red-100 text-red-700' },
}

function rankByQuery(results: { id: string; title: string; coverUrl: string }[], query: string) {
  const q = query.toLowerCase().trim()
  const score = (title: string) => {
    const t = title.toLowerCase()
    if (t === q) return 5
    if (t.startsWith(q)) return 4
    if (t.includes(q)) return 3
    // all query words present
    const words = q.split(/\s+/)
    if (words.length > 1 && words.every(w => t.includes(w))) return 2
    // any query word present
    if (words.some(w => w.length > 2 && t.includes(w))) return 1
    return 0
  }
  return [...results].sort((a, b) => score(b.title) - score(a.title))
}

export function Sources({ activeSection, onSectionChange, onOpenReader }: Props) {
  const { invoke } = useIpc()
  const {
    activeSource, results, selectedSeries, loading, error,
    pendingSeriesOpen,
    setActiveSource, setResults, setSelectedSeries, setLoading, setError, setPendingSeriesOpen
  } = useSourcesStore()
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore()
  const { addHistory } = useHistoryStore()

  const [openingChapter, setOpeningChapter] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loadingSeriesId, setLoadingSeriesId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const browseSort: BrowseSort = 'latest'
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  // Reset search and reload when switching source tabs or sort
  useEffect(() => {
    setSearchQuery('')
    setPage(1)
    setHasMore(true)
    loadBrowse(1, false, browseSort)
  }, [activeSource, browseSort])

  // Handle pending series open triggered from Library starred items
  useEffect(() => {
    if (!pendingSeriesOpen) return
    if (loadingSeriesId || selectedSeries) return
    const { sourceId, seriesId } = pendingSeriesOpen
    setPendingSeriesOpen(null)
    if (activeSource !== sourceId) setActiveSource(sourceId)
    handleSelectSeries(seriesId)
  }, [pendingSeriesOpen])

  async function loadBrowse(p: number, append: boolean, sort: BrowseSort = browseSort) {
    const reqId = ++reqIdRef.current
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await invoke('sources:browse', { sourceId: activeSource, page: p, sort })
      if (reqIdRef.current !== reqId) return
      if (append) setResults([...results, ...data])
      else setResults(data)
      setHasMore(data.length > 0)
    } catch (e) {
      if (reqIdRef.current !== reqId) return
      setError(String(e))
    } finally {
      if (reqIdRef.current === reqId) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }

  function handleLoadMore() {
    const next = page + 1
    setPage(next)
    loadBrowse(next, true)
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!value.trim()) {
        setPage(1)
        setHasMore(true)
        loadBrowse(1, false)
      } else {
        runSearch(value.trim())
      }
    }, 350)
  }

  async function runSearch(query: string) {
    const reqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    setHasMore(false)
    try {
      const data = await invoke('sources:search', { sourceId: activeSource, query })
      if (reqIdRef.current !== reqId) return
      setResults(rankByQuery(data, query))
    } catch (e) {
      if (reqIdRef.current !== reqId) return
      setError(String(e))
    } finally {
      if (reqIdRef.current === reqId) setLoading(false)
    }
  }

  async function handleSelectSeries(seriesId: string) {
    setLoadingSeriesId(seriesId)
    setError(null)
    try {
      const detail: SeriesDetail = await invoke('sources:getSeries', { sourceId: activeSource, seriesId })
      setSelectedSeries(detail)
      addHistory({ id: detail.id, title: detail.title, coverUrl: detail.coverUrl, sourceId: activeSource })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingSeriesId(null)
    }
  }

  async function handleOpenChapter(chapterId: string, chapterTitle: string) {
    setOpeningChapter(chapterId)
    try {
      const pageUrls = await invoke('sources:openChapter', { sourceId: activeSource, chapterId })
      if (pageUrls.length === 0) { setError('No pages found for this chapter'); return }
      onOpenReader(chapterId, pageUrls, chapterTitle)
    } catch (e) {
      setError(String(e))
    } finally {
      setOpeningChapter(null)
    }
  }

  async function handleLogin() {
    setLoggingIn(true)
    try {
      await invoke('sources:comixtoLogin', undefined)
      if (selectedSeries) {
        const detail = await invoke('sources:getSeries', { sourceId: activeSource, seriesId: selectedSeries.id })
        setSelectedSeries(detail)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoggingIn(false)
    }
  }

  function handleToggleFavorite() {
    if (!selectedSeries) return
    if (isFavorite(selectedSeries.id)) {
      removeFavorite(selectedSeries.id)
    } else {
      addFavorite({ id: selectedSeries.id, title: selectedSeries.title, coverUrl: selectedSeries.coverUrl, sourceId: activeSource })
    }
  }

  const sortedChapters = selectedSeries
    ? [...selectedSeries.chapters].sort((a, b) => {
        const diff = (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0)
        return sortOrder === 'desc' ? -diff : diff
      })
    : []

  const starred = selectedSeries ? isFavorite(selectedSeries.id) : false

  return (
    <div className="flex flex-col h-screen bg-bg">
      <TopNav
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        onAddFolder={() => {}}
      />

      {/* Source tabs */}
      <div className="flex gap-1 px-4 pt-2 border-b border-border bg-surface">
        {ALL_SOURCES.map(sourceId => (
          <button
            key={sourceId}
            onClick={() => { setActiveSource(sourceId); setSelectedSeries(null) }}
            className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors border-b-2 ${
              activeSource === sourceId
                ? 'border-accent text-text'
                : 'border-transparent text-text-subtle hover:text-text hover:bg-surface-raised'
            }`}
          >
            {SOURCE_LABELS[sourceId]}
          </button>
        ))}
      </div>

      {/* Per-tab search bar */}
      {!selectedSeries && (
        <div className="px-4 py-2 bg-surface border-b border-border">
          <input
            type="search"
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder={`Search ${SOURCE_LABELS[activeSource]}…`}
            className="w-full max-w-sm px-3 py-1.5 text-sm border border-border rounded-md bg-bg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-surface"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loadingSeriesId && !selectedSeries ? (
          <div className="p-4">
            <button
              onClick={() => { setLoadingSeriesId(null) }}
              className="mb-4 text-sm text-text-muted hover:text-text flex items-center gap-1"
            >
              ← Back
            </button>
            <div className="flex items-center justify-center h-48 text-text-subtle">Loading series…</div>
          </div>
        ) : selectedSeries ? (
          <div className="p-4">
            <button
              onClick={() => setSelectedSeries(null)}
              className="mb-4 text-sm text-text-muted hover:text-text flex items-center gap-1"
            >
              ← Back
            </button>
            <div className="flex gap-4 mb-6">
              {selectedSeries.coverUrl && (
                <img
                  src={selectedSeries.coverUrl}
                  alt={selectedSeries.title}
                  className="w-32 h-48 object-cover rounded shadow flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 mb-1">
                  <h2 className="text-xl font-bold text-text flex-1">{selectedSeries.title}</h2>
                  {selectedSeries.contentRating && (() => {
                    const badge = RATING_BADGE[selectedSeries.contentRating!]
                    return <span className={`flex-shrink-0 mt-1 text-xs font-semibold px-2 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  })()}
                  <button
                    onClick={handleToggleFavorite}
                    title={starred ? 'Remove from starred' : 'Add to starred'}
                    className="flex-shrink-0 mt-0.5 p-1 rounded hover:bg-surface-raised transition-colors"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={starred ? '#f59e0b' : 'none'} stroke={starred ? '#f59e0b' : '#9ca3af'} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                </div>
                {selectedSeries.genres.length > 0 && (
                  <p className="text-sm text-text-subtle mb-2">{selectedSeries.genres.join(', ')}</p>
                )}
                {selectedSeries.description && (
                  <p className="text-sm text-text-muted leading-relaxed">{selectedSeries.description}</p>
                )}
              </div>
            </div>

            {activeSource === 'comixto' && selectedSeries.loginRequired && (
              <div className="p-6 text-center border border-border rounded bg-surface">
                <p className="text-sm text-text-muted mb-3">Comix.to requires an account to view chapters.</p>
                <button
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="px-4 py-2 text-sm font-medium text-bg bg-accent rounded hover:opacity-90 disabled:opacity-50"
                >
                  {loggingIn ? 'Opening browser…' : 'Log in to Comix.to'}
                </button>
              </div>
            )}
            {activeSource === 'comixto' && !selectedSeries.loginRequired && selectedSeries.chapters.length === 0 && (
              <div className="p-4 text-sm text-text-muted bg-surface-raised border border-border rounded">
                No chapters found. Try clicking the series again, or check if this title requires a subscription.
              </div>
            )}
            {error && (
              <div className="mb-3 p-3 text-sm text-text-muted bg-surface-raised border border-border rounded-md">
                {error}
              </div>
            )}

            {/* Sort toggle */}
            {sortedChapters.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-subtle">{sortedChapters.length} chapters</span>
                <button
                  onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 text-xs text-text-subtle hover:text-text px-2 py-1 rounded hover:bg-surface-raised transition-colors"
                >
                  {sortOrder === 'desc' ? (
                    <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9L2 3h8L6 9z" fill="currentColor"/></svg>Latest first</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 3l4 6H2L6 3z" fill="currentColor"/></svg>Oldest first</>
                  )}
                </button>
              </div>
            )}

            <div className="divide-y divide-border rounded border border-border bg-surface">
              {sortedChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => handleOpenChapter(chapter.id, chapter.title ? `Ch. ${chapter.number} — ${chapter.title}` : `Chapter ${chapter.number}`)}
                  disabled={openingChapter === chapter.id}
                  className="w-full text-left px-4 py-3 hover:bg-surface-raised transition-colors flex justify-between items-center disabled:opacity-50"
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="text-xs text-text-subtle tabular-nums flex-shrink-0 min-w-[3rem]">Ch.{chapter.number}</span>
                    <span className="text-sm font-medium text-text truncate">
                      {chapter.title || ''}
                    </span>
                  </div>
                  <span className="text-xs text-text-subtle flex-shrink-0 ml-4">
                    {openingChapter === chapter.id ? 'Opening…' : chapter.date}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {!searchQuery && <LatestReleasesSection sourceId={activeSource} onSelect={handleSelectSeries} />}

            {(loading && !loadingSeriesId) && (
              <div className="flex items-center justify-center h-64 text-text-subtle">Loading…</div>
            )}
            {error && (
              <div className="mx-4 mt-4 p-3 text-sm text-text-muted bg-surface-raised border border-border rounded-md">
                {error}
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="flex items-center justify-center h-64 text-text-subtle text-sm">
                {searchQuery ? 'No results found' : 'No results'}
              </div>
            )}
            {!loading && results.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
                  {results.map((series, i) => (
                    <button
                      key={series.id + '-' + i}
                      onClick={() => handleSelectSeries(series.id)}
                      className="flex flex-col items-start text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="w-full aspect-[2/3] rounded overflow-hidden bg-surface-raised mb-1.5 relative">
                        {series.coverUrl ? (
                          <img
                            src={series.coverUrl}
                            alt={series.title}
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-subtle text-xs p-2 leading-tight">
                            {series.title}
                          </div>
                        )}
                        {/* Latest chapter badge */}
                        {series.latestChapter && (
                          <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                            {series.latestChapter}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text font-medium line-clamp-2 w-full leading-tight">{series.title}</span>
                      {series.rating != null && (
                        <span className="text-[10px] text-amber-600 font-medium mt-0.5">★ {series.rating.toFixed(1)}</span>
                      )}
                    </button>
                  ))}
                </div>
                {hasMore && !searchQuery && (
                  <div className="flex justify-center pb-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 text-sm font-medium text-text-muted border border-border rounded-md hover:bg-surface-raised transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
