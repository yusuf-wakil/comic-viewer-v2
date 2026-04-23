import { protocol } from 'electron'

// Each slot is either a pre-loaded Buffer (local comics) or a lazy Promise<Buffer> (online sources)
type PageEntry = Buffer | Promise<Buffer>
const cache = new Map<string, PageEntry[]>()

export function storePages(sessionId: string, pages: Buffer[]): void {
  cache.set(sessionId, [...pages])
}

export function storeLazyPages(sessionId: string, pages: Array<Promise<Buffer>>): void {
  cache.set(sessionId, [...pages])
}

export function clearSession(sessionId: string): void {
  cache.delete(sessionId)
}

export function registerComicPageProtocol(): void {
  protocol.handle('comic-page', async (request) => {
    const url = new URL(request.url)
    const sessionId = url.hostname
    const pageIndex = parseInt(url.pathname.slice(1), 10)
    const pages = cache.get(sessionId)

    if (!pages || isNaN(pageIndex) || pageIndex >= pages.length) {
      return new Response('Not found', { status: 404 })
    }

    const entry = pages[pageIndex]
    let buffer: Buffer
    if (Buffer.isBuffer(entry)) {
      buffer = entry
    } else {
      try {
        buffer = await entry
        pages[pageIndex] = buffer // cache the resolved buffer for future requests
      } catch (err) {
        return new Response(`Failed to fetch page: ${err}`, { status: 502 })
      }
    }

    let contentType = 'image/jpeg'
    if (buffer[0] === 0x89) contentType = 'image/png'
    else if (buffer[0] === 0x47) contentType = 'image/gif'
    else if (buffer.length >= 12 && buffer.slice(8, 12).toString() === 'WEBP') contentType = 'image/webp'

    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': contentType }
    })
  })
}
