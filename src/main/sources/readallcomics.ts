import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry, Fetcher } from '@shared/types/source'

const BASE_URL = 'https://readallcomics.com'
const HEADERS = { 'User-Agent': 'Mozilla/5.0' }

function parseImages(html: string): string[] {
  const urls: string[] = []
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = imgRe.exec(html)) !== null) {
    const src = match[1]
    if (src.startsWith('http')) urls.push(src)
  }
  return urls
}

export function createReadAllComicsProvider(fetcher: Fetcher = globalThis.fetch): SourceProvider {
  async function wpGet<T>(path: string): Promise<T> {
    const resp = await fetcher(`${BASE_URL}${path}`, { headers: HEADERS })
    if (!resp.ok) throw new Error(`ReadAllComics API error: ${resp.status}`)
    return resp.json() as Promise<T>
  }

  interface WpCategory { id: number; name: string; slug: string }
  interface WpPost {
    id: number
    slug: string
    title: { rendered: string }
    date: string
    content: { rendered: string }
  }

  return {
    id: 'readallcomics',

    async browse(page = 1): Promise<SeriesResult[]> {
      const cats = await wpGet<WpCategory[]>(
        `/wp-json/wp/v2/categories?per_page=100&page=${page}&orderby=count&order=desc`
      )
      return cats.map(c => ({ id: String(c.id), title: c.name, coverUrl: '' }))
    },

    async search(query: string): Promise<SeriesResult[]> {
      const cats = await wpGet<WpCategory[]>(
        `/wp-json/wp/v2/categories?search=${encodeURIComponent(query)}&per_page=50`
      )
      return cats.map(c => ({ id: String(c.id), title: c.name, coverUrl: '' }))
    },

    async getSeries(id: string): Promise<SeriesDetail> {
      const posts = await wpGet<WpPost[]>(
        `/wp-json/wp/v2/posts?categories=${id}&per_page=100&orderby=date&order=desc`
      )
      const coverUrl = posts.length > 0 ? (parseImages(posts[0].content.rendered)[0] ?? '') : ''
      const title = posts[0]?.title.rendered.replace(/<[^>]+>/g, '') ?? ''
      const chapters: ChapterEntry[] = posts.map(p => ({
        id: p.slug,
        number: p.slug,
        title: p.title.rendered.replace(/<[^>]+>/g, ''),
        date: p.date
      }))
      return { id, title, coverUrl, description: '', genres: [], chapters }
    },

    async getChapterPages(chapterId: string): Promise<PageEntry[]> {
      const posts = await wpGet<WpPost[]>(`/wp-json/wp/v2/posts?slug=${chapterId}`)
      if (!posts.length) return []
      return parseImages(posts[0].content.rendered).map(url => ({ url }))
    }
  }
}
