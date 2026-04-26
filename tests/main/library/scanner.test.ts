import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanFolder } from '../../../src/main/library/scanner'

let tmpDir: string

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opencomic-test-'))
  writeFileSync(join(tmpDir, 'batman-001.cbz'), 'fake')
  writeFileSync(join(tmpDir, 'batman-002.CBZ'), 'fake')
  writeFileSync(join(tmpDir, 'notes.txt'), 'ignore me')
  mkdirSync(join(tmpDir, 'subdir'))
  writeFileSync(join(tmpDir, 'subdir', 'xmen.cbz'), 'fake')
})

afterAll(() => rmSync(tmpDir, { recursive: true }))

describe('scanFolder', () => {
  it('finds CBZ files recursively', async () => {
    const comics = await scanFolder(tmpDir)
    const paths = comics.map((c) => c.path)
    expect(paths.some((p) => p.endsWith('batman-001.cbz'))).toBe(true)
    expect(paths.some((p) => p.endsWith('batman-002.CBZ'))).toBe(true)
    expect(paths.some((p) => p.endsWith('xmen.cbz'))).toBe(true)
  })

  it('ignores non-comic files', async () => {
    const comics = await scanFolder(tmpDir)
    expect(comics.every((c) => !c.path.endsWith('.txt'))).toBe(true)
  })

  it('sets format correctly', async () => {
    const comics = await scanFolder(tmpDir)
    expect(comics.every((c) => c.format === 'cbz')).toBe(true)
  })

  it('generates unique IDs', async () => {
    const comics = await scanFolder(tmpDir)
    const ids = comics.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('derives title from filename', async () => {
    const comics = await scanFolder(tmpDir)
    const batman = comics.find((c) => c.path.includes('batman-001'))
    expect(batman?.title).toBe('batman-001')
  })
})
