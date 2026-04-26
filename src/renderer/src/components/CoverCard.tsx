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
      className="group relative flex flex-col bg-surface rounded-xl overflow-hidden text-left w-full hover:scale-[1.02] hover:shadow-lg transition-transform duration-150 ease-out"
    >
      <div className="aspect-[2/3] bg-border overflow-hidden">
        {comic.coverPath ? (
          <img
            src={`comic-page://${comic.id}/cover`}
            alt={comic.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-raised">
            <span className="text-text-muted text-xs text-center px-2">{comic.title}</span>
          </div>
        )}
      </div>
      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-8 left-0 right-0 h-1 bg-border">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-medium text-text line-clamp-2">{comic.title}</p>
        {comic.series && <p className="text-xs text-text-muted truncate">{comic.series}</p>}
      </div>
    </button>
  )
}
