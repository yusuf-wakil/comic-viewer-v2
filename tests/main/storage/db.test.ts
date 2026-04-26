import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '../../../src/main/storage/db'
import {
  insertComic,
  getComicById,
  getAllComics,
  removeComic,
  upsertProgress,
  getProgress
} from '../../../src/main/storage/queries'
import type { Comic } from '../../../src/shared/types/comic'

let db: Database.Database

const testComic: Comic = {
  id: 'test-1',
  path: '/comics/batman-001.cbz',
  title: 'Batman #001',
  series: 'Batman',
  issueNumber: 1,
  coverPath: null,
  format: 'cbz',
  pageCount: 24,
  publisher: 'DC',
  year: 2022,
  genres: ['superhero', 'action'],
  addedAt: Date.now()
}

beforeEach(() => {
  db = new Database(':memory:')
  applyMigrations(db)
})

afterEach(() => db.close())

describe('comics', () => {
  it('inserts and retrieves a comic', () => {
    insertComic(db, testComic)
    const result = getComicById(db, 'test-1')
    expect(result?.title).toBe('Batman #001')
    expect(result?.genres).toEqual(['superhero', 'action'])
  })

  it('returns all comics', () => {
    insertComic(db, testComic)
    insertComic(db, { ...testComic, id: 'test-2', path: '/comics/batman-002.cbz' })
    expect(getAllComics(db)).toHaveLength(2)
  })

  it('removes a comic', () => {
    insertComic(db, testComic)
    removeComic(db, 'test-1')
    expect(getComicById(db, 'test-1')).toBeNull()
  })
})

describe('reading progress', () => {
  it('upserts and retrieves progress', () => {
    insertComic(db, testComic)
    upsertProgress(db, {
      comicId: 'test-1',
      currentPage: 5,
      totalPages: 24,
      completed: false,
      lastRead: Date.now()
    })
    const p = getProgress(db, 'test-1')
    expect(p?.currentPage).toBe(5)
    expect(p?.completed).toBe(false)
  })

  it('updates progress on second upsert', () => {
    insertComic(db, testComic)
    upsertProgress(db, {
      comicId: 'test-1',
      currentPage: 5,
      totalPages: 24,
      completed: false,
      lastRead: Date.now()
    })
    upsertProgress(db, {
      comicId: 'test-1',
      currentPage: 23,
      totalPages: 24,
      completed: true,
      lastRead: Date.now()
    })
    expect(getProgress(db, 'test-1')?.currentPage).toBe(23)
  })
})
