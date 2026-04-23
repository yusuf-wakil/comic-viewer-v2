import { describe, test, expect, vi } from 'vitest'
import { register, get } from '../../../src/main/sources/index'
import type { SourceProvider } from '../../../src/main/sources/index'

function mockProvider(id: string): SourceProvider {
  return {
    id,
    browse: vi.fn(),
    search: vi.fn(),
    getSeries: vi.fn(),
    getChapterPages: vi.fn()
  }
}

describe('source registry', () => {
  test('get throws for unknown source', () => {
    expect(() => get('nonexistent-source-xyz')).toThrow('Unknown source: nonexistent-source-xyz')
  })

  test('register then get returns same provider', () => {
    const p = mockProvider('test-source-abc')
    register(p)
    expect(get('test-source-abc')).toBe(p)
  })

  test('register overwrites existing provider with same id', () => {
    const p1 = mockProvider('overwrite-me')
    const p2 = mockProvider('overwrite-me')
    register(p1)
    register(p2)
    expect(get('overwrite-me')).toBe(p2)
  })
})
