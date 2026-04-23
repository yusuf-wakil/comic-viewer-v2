import type { Comic } from '@shared/types/comic'
import { CoverCard } from './CoverCard'

interface Props {
  comics: Comic[]
  progress: Record<string, { currentPage: number; totalPages: number }>
  onOpen: (comic: Comic) => void
}

export function CoverGrid({ comics, progress, onOpen }: Props) {
  if (comics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg font-medium">No comics yet</p>
        <p className="text-sm mt-1">Click "Add Folder" to scan a folder</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-6">
      {comics.map(comic => {
        const p = progress[comic.id]
        const pct = p && p.totalPages > 0 ? Math.round((p.currentPage / p.totalPages) * 100) : undefined
        return <CoverCard key={comic.id} comic={comic} onOpen={onOpen} progress={pct} />
      })}
    </div>
  )
}
