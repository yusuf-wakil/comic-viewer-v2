import { ipcMain, dialog, BrowserWindow, net } from 'electron'
import { createHash } from 'node:crypto'
import { getDb } from '../storage/db'
import { insertComic, getAllComics, removeComic, upsertProgress, getProgress, getSetting, setSetting } from '../storage/queries'
import { scanFolder } from '../library/scanner'
import { extractPages } from '../readers/cbz'
import { storePages, storeLazyPages } from '../protocol/comic-page'
import { register, get } from '../sources/index'
import { comixtoProvider } from '../sources/comixto'
import { yskComicsProvider } from '../sources/yskcomics'
import { comixBrowser } from '../sources/comixto-browser'
import type { IpcChannels } from '@shared/ipc/types'
import type { Fetcher, LatestUpdate } from '@shared/types/source'

type Handler<C extends keyof IpcChannels> = (
  _event: Electron.IpcMainInvokeEvent,
  req: IpcChannels[C]['req']
) => Promise<IpcChannels[C]['res']>

function handle<C extends keyof IpcChannels>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, fn as Parameters<typeof ipcMain.handle>[1])
}

export function registerHandlers(): void {
  const electronFetch: Fetcher = (url, init) => net.fetch(url, init as RequestInit) as Promise<Response>
  register(comixtoProvider)
  register(yskComicsProvider)

  const db = getDb()

  handle('library:scan', async (_e, { path }) => {
    try {
      const comics = await scanFolder(path)
      for (const comic of comics) insertComic(db, comic)
      return { ok: true, data: getAllComics(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('library:getAll', async () => {
    try {
      return { ok: true, data: getAllComics(db) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('library:remove', async (_e, { comicId }) => {
    try {
      removeComic(db, comicId)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('reader:open', async (_e, { comicId }) => {
    try {
      const comic = db.prepare('SELECT path, format FROM comics WHERE id = ?').get(comicId) as { path: string; format: string } | undefined
      if (!comic) return { ok: false, error: 'Comic not found' }
      let pages: Buffer[] = []
      if (comic.format === 'cbz' || comic.format === 'cbr') {
        pages = await extractPages(comic.path)
      } else {
        return { ok: false, error: `Format ${comic.format} not yet supported` }
      }
      const sessionId = createHash('sha1').update(comicId + Date.now()).digest('hex').slice(0, 12)
      storePages(sessionId, pages)
      const urls = pages.map((_, i) => `comic-page://${sessionId}/${i}`)
      if (pages.length > 0) {
        db.prepare('UPDATE comics SET page_count = ? WHERE id = ? AND page_count = 0').run(pages.length, comicId)
      }
      return { ok: true, data: urls }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('reader:progress', async (_e, { comicId, page }) => {
    try {
      const comic = db.prepare('SELECT page_count FROM comics WHERE id = ?').get(comicId) as { page_count: number } | undefined
      const totalPages = comic?.page_count ?? 0
      upsertProgress(db, {
        comicId,
        currentPage: page,
        totalPages,
        completed: totalPages > 0 && page >= totalPages - 1,
        lastRead: Date.now()
      })
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('reader:getProgress', async (_e, { comicId }) => {
    try {
      return { ok: true, data: getProgress(db, comicId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('dialog:openFolder', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Select Comics Folder'
      })
      return { ok: true, data: result.canceled ? null : result.filePaths[0] }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('settings:get', async (_e, { key }) => {
    try {
      return { ok: true, data: getSetting(db, key) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('settings:set', async (_e, { key, value }) => {
    try {
      setSetting(db, key, value)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:browse', async (_e, { sourceId, page, sort }) => {
    try {
      return { ok: true, data: await get(sourceId).browse(page, sort) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:getLatestUpdates', async (_e, { sourceId }) => {
    try {
      // comixto's sort param is ignored by their API — all sort values return manga sorted by
      // manga_id (creation order). We fetch 5 pages in parallel and sort by chapter_updated_at
      // ourselves to surface genuinely recent chapters. Other sources sort correctly on page 1.
      const numPages = sourceId === 'comixto' ? 5 : 1
      const pages = await Promise.all(
        Array.from({ length: numPages }, (_, i) => get(sourceId).browse(i + 1, 'latest'))
      )
      const all = pages.flat()
      const withChapter = all.filter(r => r.latestChapter)
      const sorted = [...withChapter].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      const top = (sorted.length > 0 ? sorted : withChapter).slice(0, 10)
      const updates: LatestUpdate[] = top.map(r => ({
        seriesId: r.id,
        title: r.title,
        coverUrl: r.coverUrl,
        recentChapters: r.latestChapter
          ? [{ number: r.latestChapter.replace(/^Ch\.\s*/i, ''), date: r.updatedAt ?? '' }]
          : [],
      }))
      return { ok: true, data: updates }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:search', async (_e, { sourceId, query }) => {
    try {
      return { ok: true, data: await get(sourceId).search(query) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:getSeries', async (_e, { sourceId, seriesId }) => {
    try {
      return { ok: true, data: await get(sourceId).getSeries(seriesId) }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:comixtoLogin', async () => {
    try {
      await comixBrowser.showForLogin()
      const loggedIn = await comixBrowser.isLoggedIn()
      return { ok: true, data: { loggedIn } }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  handle('sources:openChapter', async (_e, { sourceId, chapterId }) => {
    try {
      const provider = get(sourceId)
      const pageEntries = await provider.getChapterPages(chapterId)
      console.log('[handlers] openChapter got', pageEntries.length, 'pages for', chapterId)
      const sessionId = createHash('sha1').update(sourceId + chapterId + Date.now()).digest('hex').slice(0, 12)
      // Defer fetch until protocol handler requests each page (avoids concurrent CDP/fetch conflicts)
      const lazyPages = pageEntries.map(entry => {
        let p: Promise<Buffer> | null = null
        const start = (): Promise<Buffer> => {
          if (p) return p
          p = (async () => {
            if (provider.fetchPageBuffer) return provider.fetchPageBuffer(entry.url)
            const resp = await electronFetch(entry.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`)
            return Buffer.from(await resp.arrayBuffer() as ArrayBuffer)
          })()
          return p
        }
        // Return a Promise that only starts fetching when first awaited
        return new Promise<Buffer>((resolve, reject) => {
          // Use a microtask so the IPC response is sent before fetching begins
          Promise.resolve().then(() => start().then(resolve, reject))
        })
      })
      storeLazyPages(sessionId, lazyPages)
      console.log('[handlers] openChapter returning urls, sessionId:', sessionId)
      return { ok: true, data: pageEntries.map((_, i) => `comic-page://${sessionId}/${i}`) }
    } catch (e) {
      console.log('[handlers] openChapter error:', String(e))
      return { ok: false, error: String(e) }
    }
  })
}
