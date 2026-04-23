export interface Comic {
  id: string
  path: string
  title: string
  series: string
  issueNumber: number | null
  coverPath: string | null
  format: 'cbz' | 'cbr' | 'pdf' | 'epub'
  pageCount: number
  publisher: string | null
  year: number | null
  genres: string[]
  addedAt: number
}

export interface ReadingProgress {
  comicId: string
  currentPage: number
  totalPages: number
  completed: boolean
  lastRead: number
}

export type PageUrl = string  // comic-page://{sessionId}/{index}
