import { useEffect, useState } from 'react'
import { LatestReleasesCard } from './LatestReleasesCard'
import type { LatestUpdate, SourceId } from '@shared/types/source'

interface Props {
  sourceId: SourceId
  onSelect?: (seriesId: string) => void
}

export function LatestReleasesSection({ sourceId, onSelect }: Props) {
  const [updates, setUpdates] = useState<LatestUpdate[] | null>(null)

  useEffect(() => {
    let cancelled = false
    window.ipc.invoke('sources:getLatestUpdates', { sourceId })
      .then((result: { ok: boolean; data?: LatestUpdate[]; error?: string }) => {
        if (!cancelled) setUpdates(result.ok ? (result.data ?? []) : [])
      })
      .catch(() => { if (!cancelled) setUpdates([]) })
    return () => { cancelled = true }
  }, [sourceId])

  if (updates === null) return null

  return (
    <div className="px-4 pt-4 pb-2">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
        Latest Chapter
      </h2>
      {updates.length === 0 ? (
        <p className="text-text-subtle text-sm">No recent updates</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {updates.map(u => (
            <LatestReleasesCard
              key={u.seriesId}
              update={u}
              onClick={onSelect ? () => onSelect(u.seriesId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
