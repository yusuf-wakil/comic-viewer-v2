import type { Comic } from '@shared/types/comic'

interface Props {
  comic: Comic
  onOpen: (comic: Comic) => void
  progress?: number
}

export function CoverCard({ comic, onOpen, progress }: Props) {
  return (
    <button
      onClick={() => onOpen(comic)}
      className="group relative flex flex-col bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden text-left w-full"
    >
      <div className="aspect-[2/3] bg-gray-100 overflow-hidden">
        {comic.coverPath ? (
          <img
            src={`comic-page://${comic.id}/cover`}
            alt={comic.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <span className="text-gray-400 text-xs text-center px-2">{comic.title}</span>
          </div>
        )}
      </div>
      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-8 left-0 right-0 h-1 bg-gray-200">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 truncate">{comic.title}</p>
        {comic.series && <p className="text-xs text-gray-500 truncate">{comic.series}</p>}
      </div>
    </button>
  )
}
