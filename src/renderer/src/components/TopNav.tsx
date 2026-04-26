import { useState, useEffect, useRef } from 'react'
import { useReaderStore } from '../store/reader'
import { ThemeSwitcher } from './ThemeSwitcher'

interface Props {
  activeSection: 'library' | 'sources' | 'tracking' | 'labels'
  onSectionChange: (s: Props['activeSection']) => void
  onSearch?: (query: string) => void
  onAddFolder: () => void
}

export function TopNav({ activeSection, onSectionChange, onSearch, onAddFolder }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const { scrollMode, setScrollMode } = useReaderStore()

  const navItems: Array<{ id: Props['activeSection']; label: string }> = [
    { id: 'library', label: 'Library' },
    { id: 'sources', label: 'Sources' },
    { id: 'tracking', label: 'Tracking' },
    { id: 'labels', label: 'Labels' }
  ]

  useEffect(() => {
    if (!settingsOpen) return
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [settingsOpen])

  return (
    <nav
      className="flex items-center gap-1 pr-4 h-12 border-b border-border bg-surface sticky top-0 z-10"
      style={{ paddingLeft: '80px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span
        className="font-bold text-text mr-4 text-sm"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        OpenComic
      </span>

      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            activeSection === item.id
              ? 'bg-accent/20 text-accent'
              : 'text-text-muted hover:text-text hover:bg-surface-raised'
          }`}
        >
          {item.label}
        </button>
      ))}

      <div className="flex-1" />

      {onSearch && (
        <input
          type="search"
          placeholder="Search..."
          onChange={(e) => onSearch(e.target.value)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-48 px-3 py-1.5 text-sm border border-border rounded-full bg-surface text-white placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      )}

      <button
        onClick={onAddFolder}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="ml-2 px-3 py-1.5 text-sm font-medium text-text-muted border border-border rounded-md hover:bg-surface-raised hover:text-text transition-colors"
      >
        + Add Folder
      </button>

      <ThemeSwitcher />

      {/* Settings gear */}
      <div
        ref={settingsRef}
        className="relative ml-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSettingsOpen((o) => !o)}
          className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M13.3 6.6 12 6a4.6 4.6 0 0 0-.4-.9l.6-1.3a.7.7 0 0 0-.1-.8l-.9-.9a.7.7 0 0 0-.8-.1L9.1 2.4A4.6 4.6 0 0 0 8.2 2H8a.7.7 0 0 0-.7.5L6.7 4A4.6 4.6 0 0 0 5.8 4.4L4.5 3.8a.7.7 0 0 0-.8.1l-.9.9a.7.7 0 0 0-.1.8L3.3 7 3 8v.2c0 .3.2.6.5.7l1.2.6c.1.3.3.6.4.9l-.6 1.3a.7.7 0 0 0 .1.8l.9.9a.7.7 0 0 0 .8.1l1.3-.6c.3.1.6.3.9.4l.3 1.2c.1.3.4.5.7.5h1.3c.3 0 .6-.2.7-.5l.3-1.2c.3-.1.6-.3.9-.4l1.3.6a.7.7 0 0 0 .8-.1l.9-.9a.7.7 0 0 0 .1-.8L13 9.1A4.6 4.6 0 0 0 13.4 8l1.2-.3a.7.7 0 0 0 .4-.7V6.7a.7.7 0 0 0-.5-.7L13.3 6.6Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {settingsOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised border border-border rounded-lg shadow-lg z-50 py-2">
            <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Reader Settings
            </div>
            <div className="h-px bg-border mx-3 my-1" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-text">Scroll mode</span>
              <div className="flex bg-bg rounded-md overflow-hidden text-xs border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setScrollMode(false)
                    setSettingsOpen(false)
                  }}
                  data-active={String(!scrollMode)}
                  className={`px-2.5 py-1 font-medium transition-colors ${!scrollMode ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'}`}
                >
                  Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScrollMode(true)
                    setSettingsOpen(false)
                  }}
                  data-active={String(scrollMode)}
                  className={`px-2.5 py-1 font-medium transition-colors ${scrollMode ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'}`}
                >
                  Scroll
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
