import type { Tab } from '../store/tabs'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export function TabBar({ tabs, activeTabId, onSelect, onClose }: Props) {
  if (tabs.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-2 h-9 bg-gray-50 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium cursor-pointer max-w-[180px] flex-shrink-0 transition-colors ${
            tab.id === activeTabId
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          onClick={() => onSelect(tab.id)}
        >
          <span className="truncate">{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose(tab.id)
            }}
            className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
