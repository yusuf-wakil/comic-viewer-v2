import { useState, useRef, useEffect } from 'react'

const ACCENTS = [
  { name: 'Teal',   value: '#2dd4bf' },
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Amber',  value: '#fbbf24' },
  { name: 'Rose',   value: '#fb7185' },
  { name: 'Lime',   value: '#a3e635' },
]

function getCurrentAccent(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent').trim() || '#2dd4bf'
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(getCurrentAccent)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function selectAccent(value: string) {
    document.documentElement.style.setProperty('--color-accent', value)
    try { localStorage.setItem('opencomic-accent', value) } catch { /* storage unavailable */ }
    setActive(value)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        type="button"
        aria-label="Change theme"
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 1.5C8 1.5 5 4 5 8s3 6.5 3 6.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-raised border border-border rounded-lg p-2 flex gap-1.5 shadow-lg z-50">
          {ACCENTS.map(({ name, value }) => (
            <button
              key={value}
              type="button"
              aria-label={name}
              onClick={() => selectAccent(value)}
              style={{ backgroundColor: value }}
              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                active === value ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-raised' : ''
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
