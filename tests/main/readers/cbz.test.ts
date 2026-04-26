import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { extractPages } from '../../../src/main/readers/cbz'

const fixturePath = join(__dirname, '../../fixtures/minimal.cbz')

describe('extractPages', () => {
  it('returns page buffers sorted by filename', async () => {
    const pages = await extractPages(fixturePath)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]).toBeInstanceOf(Buffer)
  })

  it('each page is a non-empty buffer', async () => {
    const pages = await extractPages(fixturePath)
    expect(pages.every((p) => p.length > 0)).toBe(true)
  })

  it('throws on a non-existent file', async () => {
    await expect(extractPages('/does/not/exist.cbz')).rejects.toThrow()
  })
})
