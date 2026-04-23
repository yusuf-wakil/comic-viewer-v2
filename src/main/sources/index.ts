import type { BrowseSort, SeriesResult, SeriesDetail, PageEntry } from '@shared/types/source'

export interface SourceProvider {
  id: string
  browse(page?: number, sort?: BrowseSort): Promise<SeriesResult[]>
  search(query: string): Promise<SeriesResult[]>
  getSeries(id: string): Promise<SeriesDetail>
  getChapterPages(chapterId: string): Promise<PageEntry[]>
  fetchPageBuffer?: (url: string) => Promise<Buffer>
}

const registry = new Map<string, SourceProvider>()

export function register(provider: SourceProvider): void {
  registry.set(provider.id, provider)
}

export function get(sourceId: string): SourceProvider {
  const provider = registry.get(sourceId)
  if (!provider) throw new Error(`Unknown source: ${sourceId}`)
  return provider
}
