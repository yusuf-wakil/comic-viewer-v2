import Database from 'better-sqlite3'
import path from 'node:path'

export function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comics (
      id           TEXT PRIMARY KEY,
      path         TEXT UNIQUE NOT NULL,
      title        TEXT NOT NULL DEFAULT '',
      series       TEXT NOT NULL DEFAULT '',
      issue_number REAL,
      cover_path   TEXT,
      format       TEXT NOT NULL,
      page_count   INTEGER NOT NULL DEFAULT 0,
      publisher    TEXT,
      year         INTEGER,
      genres       TEXT NOT NULL DEFAULT '[]',
      added_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      comic_id     TEXT PRIMARY KEY REFERENCES comics(id) ON DELETE CASCADE,
      current_page INTEGER NOT NULL DEFAULT 0,
      total_pages  INTEGER NOT NULL DEFAULT 0,
      completed    INTEGER NOT NULL DEFAULT 0,
      last_read    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    // app is only available in Electron context
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    const dbPath = path.join(app.getPath('userData'), 'opencomic.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    applyMigrations(_db)
  }
  return _db
}

export function closeDb(): void {
  _db?.close()
  _db = null
}
