import { useEffect, useCallback, useState, useRef } from 'react'

interface Props {
  pageUrls: string[]
  currentPage: number
  title: string
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onPageChange: (page: number) => void
  scrollMode: boolean
  onToggleScrollMode: () => void
}

export function ReaderView({ pageUrls, currentPage, title, onNext, onPrev, onClose, onPageChange, scrollMode, onToggleScrollMode }: Props) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLImageElement | null)[]>([])
  const [visiblePage, setVisiblePage] = useState(0)

  // Reset zoom/pan when navigating pages
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [currentPage])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (scrollMode) {
      if (e.key === 'Escape') onClose()
      return
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onNext()
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onPrev()
    else if (e.key === 'Escape') onClose()
  }, [onNext, onPrev, onClose, scrollMode])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    onPageChange(currentPage)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    setZoom(z => {
      const next = Math.max(1, Math.min(5, z * factor))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    if (scrollMode) return   // ← add this line
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, scrollMode])

  useEffect(() => {
    if (!scrollMode) return
    const refs = pageRefs.current.filter(Boolean) as HTMLImageElement[]
    const ratios = new Array(refs.length).fill(0)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const i = refs.indexOf(entry.target as HTMLImageElement)
          if (i !== -1) ratios[i] = entry.intersectionRatio
        })
        // Prefer lower-indexed page on tie
        let best = 0
        for (let i = 1; i < ratios.length; i++) {
          if (ratios[i] > ratios[best]) best = i
        }
        setVisiblePage(best)
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    )
    refs.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [scrollMode, pageUrls])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }, [zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const { startX, startY, panX, panY } = dragRef.current
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) })
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  // Double-click resets zoom
  const handleDoubleClick = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  if (pageUrls.length === 0) return null

  const isFirst = currentPage === 0
  const isLast = currentPage === pageUrls.length - 1
  const isZoomed = zoom > 1

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center bg-black/90 border-b border-white/10 flex-shrink-0 h-11" style={{ paddingLeft: 80 }}>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors px-3 h-full"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="flex-1 text-center text-white text-sm font-medium truncate px-4">
          {title}
        </span>
        {/* Scroll mode toggle pill */}
        <div className="flex bg-white/10 rounded-lg overflow-hidden mr-3" style={{ fontSize: 12 }}>
          <button
            type="button"
            onClick={() => { if (scrollMode) onToggleScrollMode() }}
            data-active={String(!scrollMode)}
            className={`px-3 py-1 font-medium transition-colors ${!scrollMode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
          >
            Page
          </button>
          <button
            type="button"
            onClick={() => { if (!scrollMode) onToggleScrollMode() }}
            data-active={String(scrollMode)}
            className={`px-3 py-1 font-medium transition-colors ${scrollMode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
          >
            Scroll
          </button>
        </div>
      </div>

      {/* Image area */}
      {scrollMode ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col items-center" style={{ gap: 8, padding: '8px 0' }}>
            {pageUrls.map((url, i) => (
              <img
                key={url}
                ref={el => { pageRefs.current[i] = el }}
                src={url}
                alt={`Page ${i + 1}`}
                draggable={false}
                style={{ width: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
          style={{ cursor: isZoomed ? (dragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          {/* Left arrow — hidden when zoomed */}
          {!isZoomed && (
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center z-10 group disabled:cursor-default"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isFirst ? 'opacity-0' : 'bg-black/40 group-hover:bg-black/70 opacity-80'}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12 5l-5 5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          )}

          {/* Page image */}
          <img
            key={pageUrls[currentPage]}
            src={pageUrls[currentPage]}
            alt={`Page ${currentPage + 1}`}
            draggable={false}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.12s ease-out',
              pointerEvents: 'none',
            }}
          />

          {/* Right arrow — hidden when zoomed */}
          {!isZoomed && (
            <button
              type="button"
              onClick={onNext}
              disabled={isLast}
              className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center z-10 group disabled:cursor-default"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isLast ? 'opacity-0' : 'bg-black/40 group-hover:bg-black/70 opacity-80'}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M8 5l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          )}

          {/* Zoom hint */}
          {isZoomed && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white/70 text-xs px-2 py-1 rounded pointer-events-none">
              {Math.round(zoom * 100)}% · double-click to reset
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-center gap-6 px-4 py-3 bg-black/90 border-t border-white/10 flex-shrink-0">
        {scrollMode ? (
          <span className="text-white text-sm font-medium tabular-nums">
            Page {visiblePage + 1} of {pageUrls.length}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              className="text-white/70 hover:text-white disabled:opacity-20 text-sm font-medium transition-colors px-3 py-1 rounded hover:bg-white/10"
            >
              ← Prev
            </button>
            <span className="text-white text-sm font-medium tabular-nums min-w-[5rem] text-center">
              {currentPage + 1} / {pageUrls.length}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={isLast}
              className="text-white/70 hover:text-white disabled:opacity-20 text-sm font-medium transition-colors px-3 py-1 rounded hover:bg-white/10"
            >
              Next →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
