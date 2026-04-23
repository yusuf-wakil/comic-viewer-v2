import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry, Fetcher } from '@shared/types/source'

const BASE_URL = 'https://api.mangadex.org'
const COVER_BASE = 'https://uploads.mangadex.org/covers'
const HEADERS = { 'User-Agent': 'OpenComic/1.0' }

interface MangaAttributes {
  title: Record<string, string>
  description: Record<string, string>
  tags: { id: string; attributes: { name: Record<string, string>; group: string } }[]
}

interface MangaData {
  id: string
  attributes: MangaAttributes
  relationships: { id: string; type: string; attributes?: { fileName?: string } }[]
}

interface ChapterData {
  id: string
  attributes: { chapter: string | null; title: string | null; publishAt: string }
}

export function createMangaDexProvider(fetcher: Fetcher = globalThis.fetch): SourceProvider {
  async function apiGet<T>(path: string): Promise<T> {
    const resp = await fetcher(`${BASE_URL}${path}`, { headers: HEADERS })
    if (!resp.ok) throw new Error(`MangaDex API error: ${resp.status} ${path}`)
    return resp.json() as Promise<T>
  }

  function getTitle(attrs: MangaAttributes): string {
    return attrs.title['en'] ?? attrs.title['ja-ro'] ?? attrs.title['ja'] ?? Object.values(attrs.title)[0] ?? ''
  }

  function getCoverUrl(manga: MangaData): string {
    const rel = manga.relationships.find(r => r.type === 'cover_art')
    if (!rel?.attributes?.fileName) return ''
    return `${COVER_BASE}/${manga.id}/${rel.attributes.fileName}.256.jpg`
  }

  function toSeriesResult(m: MangaData): SeriesResult {
    return { id: m.id, title: getTitle(m.attributes), coverUrl: getCoverUrl(m) }
  }

  return {
    id: 'mangadex',

    async browse(page = 1): Promise<SeriesResult[]> {
      const offset = (page - 1) * 20
      const data = await apiGet<{ data: MangaData[] }>(
        `/manga?limit=20&offset=${offset}&includes[]=cover_art&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive`
      )
      return (data.data ?? []).map(toSeriesResult)
    },

    async search(query: string): Promise<SeriesResult[]> {
      const data = await apiGet<{ data: MangaData[] }>(
        `/manga?title=${encodeURIComponent(query)}&limit=30&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
      )
      return (data.data ?? []).map(toSeriesResult)
    },

    async getSeries(id: string): Promise<SeriesDetail> {
      const [mangaData, feedData] = await Promise.all([
        apiGet<{ data: MangaData }>(`/manga/${id}?includes[]=cover_art`),
        apiGet<{ data: ChapterData[] }>(
          `/manga/${id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
        )
      ])
      const m = mangaData.data
      // Deduplicate by chapter number: prefer entries with a title, then most recent
      const seen = new Map<string, ChapterData>()
      for (const c of feedData.data ?? []) {
        const num = c.attributes.chapter ?? 'oneshot'
        const existing = seen.get(num)
        if (!existing) {
          seen.set(num, c)
        } else {
          const hasTitle = c.attributes.title?.trim()
          const existingHasTitle = existing.attributes.title?.trim()
          if ((hasTitle && !existingHasTitle) || (!existingHasTitle && c.attributes.publishAt > existing.attributes.publishAt)) {
            seen.set(num, c)
          }
        }
      }
      const chapters: ChapterEntry[] = Array.from(seen.values()).map(c => ({
        id: c.id,
        number: c.attributes.chapter ?? '',
        title: c.attributes.title ?? '',
        date: c.attributes.publishAt ? c.attributes.publishAt.slice(0, 10) : ''
      }))
      const genres = m.attributes.tags
        .filter(t => t.attributes.group === 'genre' && t.attributes.name['en'])
        .map(t => t.attributes.name['en'])
      const description = m.attributes.description['en'] ?? Object.values(m.attributes.description)[0] ?? ''
      return {
        id,
        title: getTitle(m.attributes),
        coverUrl: getCoverUrl(m),
        description,
        genres,
        chapters
      }
    },

    async getChapterPages(chapterId: string): Promise<PageEntry[]> {
      const data = await apiGet<{ baseUrl: string; chapter: { hash: string; data: string[] } }>(
        `/at-home/server/${chapterId}`
      )
      const { baseUrl, chapter } = data
      return (chapter.data ?? []).map(filename => ({
        url: `${baseUrl}/data/${chapter.hash}/${filename}`
      }))
    }
  }
}
