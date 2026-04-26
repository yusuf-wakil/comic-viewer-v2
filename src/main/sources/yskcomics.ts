import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry } from '@shared/types/source'
import { net } from 'electron'

const API = 'https://api.ysk-comics.com/api/v1'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'x-api-key': process.env.YSK_API_KEY ?? '123456',
}

async function get<T>(path: string): Promise<T> {
  const resp = await net.fetch(`${API}${path}`, { headers: HEADERS })
  if (!resp.ok) throw new Error(`YSK Comics API ${resp.status}: ${path}`)
  return resp.json() as Promise<T>
}

interface ComicItem {
  id: number
  image: string
  full_name: string
  slug: string
  rate: string
  rate_count: number
  writer: string | { name: string }
  genres: Array<{ id: number; name: string; slug: string }>
}

interface PaginatedResponse<T> {
  status: boolean
  data: { data_messages: T[]; meta: { total_pages: number; current_page: number } }
}

interface ComicDetail {
  id: number
  full_name: string
  slug: string
  image: string
  rate: string
  description: string
  writer: { id: number; name: string; slug: string }
  publisher: { id: number; name: string; slug: string }
  genres: Array<{ id: number; name: string; slug: string }>
  status: string
  published_at: string
}

interface ChapterItem {
  id: number
  name: string
  slug: string
  rank: string
  image: string
}

function mapComic(m: ComicItem): SeriesResult {
  return {
    id: m.slug,
    title: m.full_name,
    coverUrl: m.image,
    rating: parseFloat(m.rate) || undefined,
  }
}

// --- Full catalog cache for client-side search ---

let catalogCache: SeriesResult[] | null = null
let catalogCacheTime = 0
let catalogFetchPromise: Promise<SeriesResult[]> | null = null
const CATALOG_TTL = 60 * 60 * 1000 // 1 hour

function isCacheStale(): boolean {
  return catalogCache === null || Date.now() - catalogCacheTime > CATALOG_TTL
}

function warmCatalog(): void {
  if (isCacheStale() && !catalogFetchPromise) {
    catalogFetchPromise = buildCatalog().then(c => {
      catalogCache = c
      catalogCacheTime = Date.now()
      catalogFetchPromise = null
      return c
    })
  }
}

async function getFullCatalog(): Promise<SeriesResult[]> {
  if (!isCacheStale() && catalogCache) return catalogCache
  if (!catalogFetchPromise) {
    catalogFetchPromise = buildCatalog().then(c => {
      catalogCache = c
      catalogCacheTime = Date.now()
      catalogFetchPromise = null
      return c
    })
  }
  return catalogFetchPromise
}

async function buildCatalog(): Promise<SeriesResult[]> {
  // Use filter/comics (sorted by ID) so classic comics like Spawn appear early
  // and the full catalog is reliably indexed regardless of update recency
  const first = await get<PaginatedResponse<ComicItem>>('/filter/comics?page=1')
  const totalPages = first.data.meta.total_pages
  const all: ComicItem[] = [...first.data.data_messages]

  // Fetch remaining pages in parallel batches of 5 to avoid rate-limiting
  const BATCH = 5
  for (let start = 2; start <= totalPages; start += BATCH) {
    const end = Math.min(start + BATCH - 1, totalPages)
    const batch = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) =>
        get<PaginatedResponse<ComicItem>>(`/filter/comics?page=${start + i}`)
      )
    )
    for (const p of batch) all.push(...p.data.data_messages)
  }

  return all.map(mapComic)
}

// --- Chapter helpers ---

async function fetchAllChapters(slug: string): Promise<ChapterEntry[]> {
  const chapters: ChapterEntry[] = []
  let page = 1
  while (true) {
    const data = await get<PaginatedResponse<ChapterItem>>(`/comics/${slug}/chapters?page=${page}`)
    for (const c of data.data.data_messages) {
      chapters.push({ id: c.slug, number: c.rank, title: '', date: '' })
    }
    if (page >= data.data.meta.total_pages) break
    page++
  }
  return chapters
}

export const yskComicsProvider: SourceProvider = {
  id: 'yskcomics',

  async browse(page = 1): Promise<SeriesResult[]> {
    // Kick off background catalog fetch so search is warm by the time the user types
    warmCatalog()
    const data = await get<PaginatedResponse<ComicItem>>(`/home/latest-comics?page=${page}`)
    return data.data.data_messages.map(mapComic)
  },

  async search(query: string): Promise<SeriesResult[]> {
    const catalog = await getFullCatalog()
    const q = query.toLowerCase().trim()
    if (!q) return catalog.slice(0, 50)
    return catalog.filter(c => c.title.toLowerCase().includes(q))
  },

  async getSeries(id: string): Promise<SeriesDetail> {
    interface DetailWrapper { status: boolean; data: ComicDetail }
    const raw = await get<DetailWrapper>(`/comics/${id}`)
    const d = raw.data
    const chapters = await fetchAllChapters(id)
    return {
      id,
      title: d.full_name,
      coverUrl: d.image,
      description: d.description ?? '',
      genres: (d.genres ?? []).map(g => g.name),
      chapters,
    }
  },

  async getChapterPages(chapterId: string): Promise<PageEntry[]> {
    interface ImagesResponse { status: boolean; data: string[] }
    const raw = await get<ImagesResponse>(`/chapters/${chapterId}/images`)
    return raw.data.map(url => ({ url }))
  },

  async fetchPageBuffer(url: string): Promise<Buffer> {
    const resp = await net.fetch(url, { headers: { ...HEADERS, Referer: 'https://www.ysk-comics.com/' } })
    if (!resp.ok) throw new Error(`YSK Comics image fetch failed: ${resp.status}`)
    return Buffer.from(await resp.arrayBuffer())
  },
}
