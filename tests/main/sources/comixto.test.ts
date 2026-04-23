import { describe, test, expect, vi } from 'vitest'
import { createComixToProvider } from '../../../src/main/sources/comixto'

function makeFetcher(responses: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    for (const [pattern, body] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve(new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }))
      }
    }
    return Promise.resolve(new Response('{}', { status: 200 }))
  })
}

describe('Comix.to provider', () => {
  test('returns provider with id "comixto"', () => {
    expect(createComixToProvider(vi.fn()).id).toBe('comixto')
  })

  test('browse maps manga list to SeriesResult[]', async () => {
    const fetcher = makeFetcher({
      '/api/v2/manga': {
        result: [{ hash_id: 'abc123', title: 'Demon Slayer', poster: 'https://cdn.example.com/ds.jpg' }]
      }
    })
    const results = await createComixToProvider(fetcher).browse()
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ id: 'abc123', title: 'Demon Slayer', coverUrl: 'https://cdn.example.com/ds.jpg' })
  })

  test('search appends q param to manga endpoint', async () => {
    const fetcher = makeFetcher({
      '/api/v2/manga': { result: [{ hash_id: 'x1', title: 'Attack on Titan', poster: '' }] }
    })
    await createComixToProvider(fetcher).search('titan')
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('q=titan'),
      expect.anything()
    )
  })

  test('getSeries fetches detail and chapter list in parallel', async () => {
    const fetcher = makeFetcher({
      '/api/v2/manga/abc123/chapter-indexes': {
        result: [{ chapter_id: 'ch1', chapter_number: '1', chapter_title: 'Chapter 1', upload_date: '2023-01-01' }]
      },
      '/api/v2/manga/abc123': {
        result: { hash_id: 'abc123', title: 'Demon Slayer', description: 'A demon hunter story', genres: ['Action'], poster: 'https://cdn.example.com/ds.jpg' }
      }
    })
    const detail = await createComixToProvider(fetcher).getSeries('abc123')
    expect(detail.title).toBe('Demon Slayer')
    expect(detail.description).toBe('A demon hunter story')
    expect(detail.genres).toEqual(['Action'])
    expect(detail.chapters).toHaveLength(1)
    expect(detail.chapters[0]).toMatchObject({ id: 'ch1', number: '1', title: 'Chapter 1' })
  })

  test('getChapterPages returns page URL list', async () => {
    const fetcher = makeFetcher({
      '/api/v2/chapters/ch1': {
        result: {
          images: [
            { url: 'https://cdn.example.com/p1.webp' },
            { url: 'https://cdn.example.com/p2.webp' }
          ]
        }
      }
    })
    const pages = await createComixToProvider(fetcher).getChapterPages('ch1')
    expect(pages).toHaveLength(2)
    expect(pages[0].url).toBe('https://cdn.example.com/p1.webp')
    expect(pages[0].decryptionKey).toBeUndefined()
  })
})
