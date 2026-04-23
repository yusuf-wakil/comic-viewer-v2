import Database from 'better-sqlite3'
import type { Comic, ReadingProgress } from '@shared/types/comic'

function rowToComic(row: Record<string, unknown>): Comic {
  return {
    id: row.id as string,
    path: row.path as string,
    title: row.title as string,
    series: row.series as string,
    issueNumber: row.issue_number as number | null,
    coverPath: row.cover_path as string | null,
    format: row.format as Comic['format'],
    pageCount: row.page_count as number,
    publisher: row.publisher as string | null,
    year: row.year as number | null,
    genres: JSON.parse(row.genres as string) as string[],
    addedAt: row.added_at as number
  }
}

export function insertComic(db: Database.Database, comic: Comic): void {
  db.prepare(`
    INSERT OR REPLACE INTO comics
      (id, path, title, series, issue_number, cover_path, format, page_count, publisher, year, genres, added_at)
    VALUES
      (@id, @path, @title, @series, @issueNumber, @coverPath, @format, @pageCount, @publisher, @year, @genres, @addedAt)
  `).run({ ...comic, genres: JSON.stringify(comic.genres) })
}

export function getComicById(db: Database.Database, id: string): Comic | null {
  const row = db.prepare('SELECT * FROM comics WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToComic(row) : null
}

export function getComicByPath(db: Database.Database, filePath: string): Comic | null {
  const row = db.prepare('SELECT * FROM comics WHERE path = ?').get(filePath) as Record<string, unknown> | undefined
  return row ? rowToComic(row) : null
}

export function getAllComics(db: Database.Database): Comic[] {
  const rows = db.prepare('SELECT * FROM comics ORDER BY series, issue_number').all() as Record<string, unknown>[]
  return rows.map(rowToComic)
}

export function removeComic(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM comics WHERE id = ?').run(id)
}

export function upsertProgress(db: Database.Database, p: ReadingProgress): void {
  db.prepare(`
    INSERT OR REPLACE INTO reading_progress (comic_id, current_page, total_pages, completed, last_read)
    VALUES (@comicId, @currentPage, @totalPages, @completed, @lastRead)
  `).run({ ...p, completed: p.completed ? 1 : 0 })
}

export function getProgress(db: Database.Database, comicId: string): ReadingProgress | null {
  const row = db.prepare('SELECT * FROM reading_progress WHERE comic_id = ?').get(comicId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    comicId: row.comic_id as string,
    currentPage: row.current_page as number,
    totalPages: row.total_pages as number,
    completed: row.completed === 1,
    lastRead: row.last_read as number
  }
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}
