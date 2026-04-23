import { describe, test, expect, vi } from 'vitest'
import { createReadAllComicsProvider } from '../../../src/main/sources/readallcomics'

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
    return Promise.resolve(new Response('[]', { status: 200 }))
  })
}

describe('ReadAllComics provider', () => {
  test('returns provider with id "readallcomics"', () => {
    expect(createReadAllComicsProvider(vi.fn()).id).toBe('readallcomics')
  })

  test('browse maps WP categories to SeriesResult[]', async () => {
    const fetcher = makeFetcher({
      'wp/v2/categories': [{ id: 42, name: 'Batman', slug: 'batman', description: '' }]
    })
    const results = await createReadAllComicsProvider(fetcher).browse()
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ id: '42', title: 'Batman', coverUrl: '' })
  })

  test('search passes query param to WP categories endpoint', async () => {
    const fetcher = makeFetcher({
      'wp/v2/categories': [{ id: 7, name: 'Spider-Man', slug: 'spider-man', description: '' }]
    })
    const results = await createReadAllComicsProvider(fetcher).search('spider')
    expect(results[0].title).toBe('Spider-Man')
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('search=spider'),
      expect.anything()
    )
  })

  test('getSeries fetches category posts and returns chapters with cover', async () => {
    const fetcher = makeFetcher({
      '/posts?categories=42': [
        {
          id: 100,
          slug: 'batman-1',
          title: { rendered: 'Batman #1' },
          date: '2023-01-01T00:00:00',
          content: { rendered: '<img src="https://cdn.example.com/cover.jpg" />' }
        }
      ]
    })
    const detail = await createReadAllComicsProvider(fetcher).getSeries('42')
    expect(detail.id).toBe('42')
    expect(detail.coverUrl).toBe('https://cdn.example.com/cover.jpg')
    expect(detail.chapters).toHaveLength(1)
    expect(detail.chapters[0]).toMatchObject({ id: 'batman-1', title: 'Batman #1' })
  })

  test('getChapterPages parses img tags from WP post content.rendered', async () => {
    const fetcher = makeFetcher({
      '/posts?slug=batman-1': [
        {
          id: 100,
          slug: 'batman-1',
          title: { rendered: 'Batman #1' },
          date: '2023-01-01T00:00:00',
          content: {
            rendered: '<img src="https://i0.wp.com/p1.jpg"/><img src="https://i0.wp.com/p2.jpg"/>'
          }
        }
      ]
    })
    const pages = await createReadAllComicsProvider(fetcher).getChapterPages('batman-1')
    expect(pages).toHaveLength(2)
    expect(pages[0].url).toBe('https://i0.wp.com/p1.jpg')
    expect(pages[1].url).toBe('https://i0.wp.com/p2.jpg')
    expect(pages[0].decryptionKey).toBeUndefined()
  })

  test('getChapterPages returns empty array when post not found', async () => {
    const fetcher = makeFetcher({ '/posts?slug=missing': [] })
    const pages = await createReadAllComicsProvider(fetcher).getChapterPages('missing')
    expect(pages).toEqual([])
  })
})
