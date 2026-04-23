import { useState } from 'react'
import { Library } from './pages/Library'
import { Sources } from './pages/Sources'
import { Reader } from './pages/Reader'
import { useReaderStore } from './store/reader'

type Section = 'library' | 'sources' | 'tracking' | 'labels'

export function App() {
  const [activeSection, setActiveSection] = useState<Section>('library')
  const [readerState, setReaderState] = useState<{ comicId: string; pageUrls: string[]; title: string } | null>(null)
  const { open: openReader, close: closeReader } = useReaderStore()

  function handleOpenReader(comicId: string, pageUrls: string[], title: string) {
    openReader(comicId, pageUrls)
    setReaderState({ comicId, pageUrls, title })
  }

  function handleCloseReader() {
    closeReader()
    setReaderState(null)
  }

  return (
    <>
      {activeSection === 'library' && (
        <Library
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onOpenReader={handleOpenReader}
        />
      )}
      {activeSection === 'sources' && (
        <Sources
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onOpenReader={handleOpenReader}
        />
      )}
      {(activeSection === 'tracking' || activeSection === 'labels') && (
        <div className="flex flex-col h-screen bg-gray-50">
          <div className="flex items-center gap-1 pr-4 h-12 border-b border-gray-200 bg-white sticky top-0 z-10" style={{ paddingLeft: '80px' }}>
            <span className="font-bold text-gray-900 mr-4 text-sm">OpenComic</span>
            {(['library', 'sources', 'tracking', 'labels'] as Section[]).map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeSection === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} — coming soon
          </div>
        </div>
      )}
      {readerState && (
        <Reader
          comicId={readerState.comicId}
          pageUrls={readerState.pageUrls}
          title={readerState.title}
          onClose={handleCloseReader}
        />
      )}
    </>
  )
}
