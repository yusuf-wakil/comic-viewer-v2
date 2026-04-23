export type SourceId = 'readallcomics' | 'mangakakalot' | 'comixto'

export type BrowseSort = 'latest' | 'popular' | 'rating' | 'new'

export interface SeriesResult {
  id: string
  title: string
  coverUrl: string
  latestChapter?: string
  rating?: number
}

export interface ChapterEntry {
  id: string
  number: string
  title: string
  date: string
}

export type ContentRating = 'all-ages' | 'teen' | 'mature' | 'adult'

export interface SeriesDetail {
  id: string
  title: string
  coverUrl: string
  description: string
  genres: string[]
  chapters: ChapterEntry[]
  loginRequired?: boolean
  contentRating?: ContentRating
}

export interface PageEntry {
  url: string
  decryptionKey?: Uint8Array
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>
