interface Props {
  activeSection: 'library' | 'sources' | 'tracking' | 'labels'
  onSectionChange: (s: Props['activeSection']) => void
  onSearch?: (query: string) => void
  onAddFolder: () => void
}

export function TopNav({ activeSection, onSectionChange, onSearch, onAddFolder }: Props) {
  const navItems: Array<{ id: Props['activeSection']; label: string }> = [
    { id: 'library', label: 'Library' },
    { id: 'sources', label: 'Sources' },
    { id: 'tracking', label: 'Tracking' },
    { id: 'labels', label: 'Labels' }
  ]

  return (
    <nav
      className="flex items-center gap-1 pr-4 h-12 border-b border-gray-200 bg-white sticky top-0 z-10"
      style={{ paddingLeft: '80px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="font-bold text-gray-900 mr-4 text-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>OpenComic</span>

      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            activeSection === item.id
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          onChange={e => onSearch(e.target.value)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
        />
      )}

      <button
        onClick={onAddFolder}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="ml-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
      >
        + Add Folder
      </button>
    </nav>
  )
}
