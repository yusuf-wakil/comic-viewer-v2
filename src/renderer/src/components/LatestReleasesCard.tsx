import type { LatestUpdate } from '@shared/types/source'

interface Props {
  update: LatestUpdate
}

export function LatestReleasesCard({ update }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 flex gap-3">
      <div className="w-11 h-16 flex-shrink-0 rounded-md overflow-hidden bg-border">
        {update.coverUrl ? (
          <img
            src={update.coverUrl}
            alt={update.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text text-sm line-clamp-1 mb-1">{update.title}</p>
        {update.recentChapters.map((ch, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-accent font-semibold text-sm">{ch.number}</span>
            <span className="text-text-subtle text-xs">{ch.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
