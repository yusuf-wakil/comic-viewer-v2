import { BrowserWindow, session } from 'electron'

const CF_INDICATORS = ['/cdn-cgi/challenge-platform/', 'Just a moment', 'Checking your browser']
const PARTITION = 'persist:comixto'
const BASE_URL = 'https://comix.to'
const CHALLENGE_TIMEOUT_MS = 120_000
const NAV_TIMEOUT_MS = 30_000

export class ComixBrowser {
  private win: BrowserWindow | null = null
  private cfResolve: (() => void) | null = null
  private cfTimeout: ReturnType<typeof setTimeout> | null = null
  private cfPending: Promise<void> | null = null
  private initialized = false
  private cancelCapture: (() => void) | null = null

  getSession() {
    return session.fromPartition(PARTITION)
  }

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win

    this.win = new BrowserWindow({
      show: false,
      width: 960,
      height: 720,
      title: 'Comix.to — Complete verification',
      webPreferences: {
        session: this.getSession(),
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    this.win.webContents.on('did-finish-load', () => {
      if (!this.win) return
      const url = this.win.webContents.getURL()
      const title = this.win.getTitle()
      const isCF = CF_INDICATORS.some((s) => url.includes(s) || title.includes(s))
      if (!isCF && this.cfResolve) {
        this.clearCfTimeout()
        const cb = this.cfResolve
        this.cfResolve = null
        this.initialized = true
        this.win.hide()
        cb()
      }
    })

    this.win.webContents.on('console-message', (_e, _level, msg) => {
      if (msg.startsWith('[comixto-browser]')) console.log(msg)
    })
    this.win.on('closed', () => {
      this.win = null
    })
    return this.win
  }

  private clearCfTimeout(): void {
    if (this.cfTimeout) {
      clearTimeout(this.cfTimeout)
      this.cfTimeout = null
    }
  }

  private challengeSession(): Promise<void> {
    if (this.initialized) return Promise.resolve()
    if (this.cfPending) return this.cfPending
    this.cfPending = new Promise<void>((resolve, reject) => {
      this.cfResolve = resolve
      this.cfTimeout = setTimeout(() => {
        this.cfResolve = null
        this.cfPending = null
        reject(new Error('Comix.to: Cloudflare challenge timed out'))
      }, CHALLENGE_TIMEOUT_MS)
      const win = this.ensureWindow()
      win.show()
      win.center()
      win.loadURL(BASE_URL)
    })
    this.cfPending.then(
      () => {
        this.cfPending = null
      },
      () => {
        this.cfPending = null
      }
    )
    return this.cfPending
  }

  /** Fetch using Comix.to session cookies (bypass Cloudflare).
   *  Manually attaches session cookies because ses.fetch() does not send them automatically. */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    await this.challengeSession()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ses = this.getSession() as any
    const cookies = await this.getSession().cookies.get({ domain: 'comix.to' })
    const cookieHeader = cookies.map((c: Electron.Cookie) => `${c.name}=${c.value}`).join('; ')
    const mergedHeaders = {
      ...((init?.headers as Record<string, string>) ?? {}),
      Cookie: cookieHeader
    }
    const mergedInit = { ...init, headers: mergedHeaders }
    const resp: Response = await ses.fetch(url, mergedInit)
    if (resp.status === 403 || resp.status === 503) {
      this.initialized = false
      await this.challengeSession()
      const cookies2 = await this.getSession().cookies.get({ domain: 'comix.to' })
      const cookieHeader2 = cookies2.map((c: Electron.Cookie) => `${c.name}=${c.value}`).join('; ')
      return ses.fetch(url, {
        ...mergedInit,
        headers: { ...mergedHeaders, Cookie: cookieHeader2 }
      }) as Promise<Response>
    }
    return resp
  }

  /** Navigate the hidden window to a URL, execute a JS script once loaded,
   *  then navigate away to free memory. The script may return a Promise. */
  async navigateAndRun<T>(url: string, script: string): Promise<T> {
    // Cancel any ongoing chapter-list capture so the window is free
    if (this.cancelCapture) {
      this.cancelCapture()
      this.cancelCapture = null
    }
    await new Promise((r) => setTimeout(r, 200)) // brief yield for cleanup
    await this.challengeSession()
    const win = this.ensureWindow()

    // Wait for page to load (handle CF re-challenge mid-flow)
    await new Promise<void>((resolve, reject) => {
      const navTimeout = setTimeout(() => reject(new Error('Page load timed out')), NAV_TIMEOUT_MS)

      const onLoad = () => {
        clearTimeout(navTimeout)
        const pageUrl = win.webContents.getURL()
        const title = win.getTitle()
        const isCF = CF_INDICATORS.some((s) => pageUrl.includes(s) || title.includes(s))
        if (isCF) {
          this.initialized = false
          win.show()
          win.center()
          this.cfResolve = () => {
            win.webContents.once('did-finish-load', () => resolve())
            win.loadURL(url)
          }
          this.cfTimeout = setTimeout(() => {
            this.cfResolve = null
            reject(new Error('Comix.to: re-challenge timed out'))
          }, CHALLENGE_TIMEOUT_MS)
          return
        }
        resolve()
      }

      win.webContents.once('did-finish-load', onLoad)
      win.loadURL(url)
    })

    try {
      const result = (await win.webContents.executeJavaScript(script)) as T
      win.loadURL('about:blank')
      return result
    } catch (e) {
      win.loadURL('about:blank')
      throw e
    }
  }

  /** Navigate to a page and capture the body of the first response matching urlSubstring.
   *  Uses CDP (debugger) so we get the exact JSON the page's own fetch receives. */
  async navigateAndCapture(
    pageUrl: string,
    urlSubstring: string,
    timeoutMs = NAV_TIMEOUT_MS
  ): Promise<string> {
    if (this.cancelCapture) {
      this.cancelCapture()
      this.cancelCapture = null
    }
    await new Promise((r) => setTimeout(r, 200))
    await this.challengeSession()
    const win = this.ensureWindow()
    const dbg = win.webContents.debugger

    if (!dbg.isAttached()) dbg.attach('1.3')
    await dbg.sendCommand('Network.enable')

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('navigateAndCapture timed out'))
      }, timeoutMs)

      const requestMap = new Map<string, boolean>()

      function cleanup() {
        clearTimeout(timeout)
        if (!win.isDestroyed())
          win.webContents.debugger.sendCommand('Network.disable').catch(() => {})
      }

      const onMsg = (_e: Electron.Event, method: string, params: Record<string, unknown>) => {
        if (method === 'Network.responseReceived') {
          const resp = params.response as { url: string; status?: number }
          if (resp?.url?.includes('/api/v2/')) {
            console.log('[comixto] CDP saw API:', resp.url, 'status:', resp.status)
          }
          if (resp?.url?.includes(urlSubstring)) {
            requestMap.set(params.requestId as string, true)
          }
        }
        if (method === 'Network.loadingFinished' && requestMap.has(params.requestId as string)) {
          const reqId = params.requestId as string
          requestMap.delete(reqId)
          dbg.removeListener('message', onMsg)
          cleanup()
          dbg
            .sendCommand('Network.getResponseBody', { requestId: reqId })
            .then((body: { body: string }) => {
              console.log('[comixto] captured chapters body:', body.body.slice(0, 200))
              resolve(body.body)
            })
            .catch((e: Error) => reject(e))
        }
      }
      dbg.on('message', onMsg)

      const navTimeout = setTimeout(() => {
        dbg.removeListener('message', onMsg)
        cleanup()
        reject(new Error('Page load timed out'))
      }, timeoutMs)
      win.webContents.once('did-finish-load', () => clearTimeout(navTimeout))
      win.loadURL(pageUrl)
    })
  }

  /** Navigate to a chapter page and capture the first API response that contains image URLs.
   *  Logs all /api/v2/ responses seen so the correct URL pattern can be identified. */
  async navigateAndCaptureChapterPages(
    pageUrl: string,
    timeoutMs = NAV_TIMEOUT_MS
  ): Promise<string> {
    if (this.cancelCapture) {
      this.cancelCapture()
      this.cancelCapture = null
    }
    await new Promise((r) => setTimeout(r, 200))
    await this.challengeSession()
    const win = this.ensureWindow()
    const dbg = win.webContents.debugger

    if (!dbg.isAttached()) dbg.attach('1.3')
    await dbg.sendCommand('Network.enable')

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('navigateAndCaptureChapterPages timed out'))
      }, timeoutMs)

      const requestMap = new Map<string, boolean>()

      function cleanup() {
        clearTimeout(timeout)
        dbg.removeListener('message', onMsg)
        if (!win.isDestroyed())
          win.webContents.debugger.sendCommand('Network.disable').catch(() => {})
      }

      const cdnImageUrls: string[] = []
      let batchTimer: ReturnType<typeof setTimeout> | null = null

      const flushImages = () => {
        if (settled || cdnImageUrls.length === 0) return
        settled = true
        cleanup()
        if (!win.isDestroyed()) win.loadURL('about:blank')
        resolve(JSON.stringify({ images: cdnImageUrls }))
      }

      const onMsg = (_e: Electron.Event, method: string, params: Record<string, unknown>) => {
        if (settled) return
        if (method === 'Network.responseReceived') {
          const resp = params.response as { url: string; status?: number; mimeType?: string }
          const u = resp?.url ?? ''
          if (
            !u.includes('/_next/static') &&
            !u.includes('.css') &&
            !u.includes('.js') &&
            !u.includes('favicon') &&
            !u.startsWith('data:')
          ) {
            console.log(
              '[comixto] chapter CDP request:',
              u,
              'status:',
              resp.status,
              'mime:',
              resp.mimeType
            )
          }
          // Collect CDN image URLs (chapter pages load directly as images, not via JSON API)
          if (
            resp?.mimeType?.startsWith('image/') &&
            resp.status === 200 &&
            !u.includes('comix.to') &&
            !u.startsWith('data:')
          ) {
            cdnImageUrls.push(u)
            if (batchTimer) clearTimeout(batchTimer)
            batchTimer = setTimeout(flushImages, 4000) // resolve 4s after last image (allows full-page scroll to finish)
          }
          // Also try JSON API responses as fallback
          if (resp?.mimeType?.includes('json') || u.includes('/api/')) {
            requestMap.set(params.requestId as string, true)
          }
        }
        if (method === 'Network.loadingFinished' && requestMap.has(params.requestId as string)) {
          const reqId = params.requestId as string
          requestMap.delete(reqId)
          dbg
            .sendCommand('Network.getResponseBody', { requestId: reqId })
            .then((body: { body: string }) => {
              if (settled) return
              if (/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp|gif)/i.test(body.body)) {
                settled = true
                if (batchTimer) clearTimeout(batchTimer)
                cleanup()
                resolve(body.body)
              }
            })
            .catch(() => {})
        }
      }
      dbg.on('message', onMsg)

      win.webContents.once('did-finish-load', () => {
        console.log('[comixto] chapter page loaded, injecting scroll trigger...')
        // Scroll through the full page height in steps to trigger all lazy images.
        // Do NOT set img.loading=eager — causes OOM.
        win.webContents
          .executeJavaScript(
            `
          (function() {
            var pos = 0;
            var stepSize = 700;
            var intervalMs = 350;
            // Brief delay for React to hydrate before scrolling
            setTimeout(function() {
              var t = setInterval(function() {
                var h = document.documentElement.scrollHeight;
                pos += stepSize;
                window.scrollTo(0, pos);
                if (pos >= h) {
                  clearInterval(t);
                  console.log('[comixto] scroll complete, pageHeight=' + h);
                }
              }, intervalMs);
            }, 1200);
          })()
        `
          )
          .catch(() => {})
      })

      win.loadURL(pageUrl)
    })
  }

  /** Show the comix.to window so the user can log in.
   *  Resolves automatically once login is detected (via cookie watch), or when window is closed. */
  showForLogin(): Promise<void> {
    return new Promise<void>((resolve) => {
      const win = this.ensureWindow()
      const ses = this.getSession()

      let settled = false

      const done = () => {
        if (settled) return
        settled = true
        ses.cookies.removeListener('changed', onCookieChanged)
        this.initialized = true
        resolve()
      }

      // Watch for the Laravel remember-me cookie — this is set exactly when login succeeds
      const onCookieChanged = (
        _e: Electron.Event,
        cookie: Electron.Cookie,
        _cause: string,
        removed: boolean
      ) => {
        console.log('[comixto] cookie set:', cookie.name)
        if (!removed && cookie.name.startsWith('remember_web_')) {
          console.log('[comixto] auth cookie detected — closing login window')
          win.hide()
          done()
        }
      }
      ses.cookies.on('changed', onCookieChanged)

      win.once('hide', done)
      win.once('closed', done)

      win.setTitle('Comix.to — Log in (window will close automatically)')
      win.loadURL(BASE_URL)
      win.show()
      win.center()
    })
  }

  /** Test if the current session has valid auth by calling the chapters endpoint. */
  async isLoggedIn(testMangaId = 'o1rd'): Promise<boolean> {
    try {
      const ses = this.getSession() as unknown as {
        fetch: (url: string, init?: RequestInit) => Promise<Response>
      }
      const resp = await ses.fetch(
        `${BASE_URL}/api/v2/manga/${testMangaId}/chapters?page=1&limit=1`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
        } as RequestInit
      )
      const d = (await resp.json()) as { status?: number; result?: unknown }
      return typeof d.status === 'number'
        ? d.status < 400
        : d.result !== null && d.result !== undefined
    } catch {
      return false
    }
  }

  /** Like navigateAndRun but reads the fresh XSRF-TOKEN cookie from the session after page load
   *  and replaces the given placeholder in the script before executing it. */
  async navigateAndRunWithXsrf<T>(
    url: string,
    scriptTemplate: string,
    placeholder: string
  ): Promise<T> {
    await this.challengeSession()
    const win = this.ensureWindow()

    await new Promise<void>((resolve, reject) => {
      const navTimeout = setTimeout(() => reject(new Error('Page load timed out')), NAV_TIMEOUT_MS)

      const onLoad = () => {
        clearTimeout(navTimeout)
        const pageUrl = win.webContents.getURL()
        const title = win.getTitle()
        const isCF = CF_INDICATORS.some((s) => pageUrl.includes(s) || title.includes(s))
        if (isCF) {
          this.initialized = false
          win.show()
          win.center()
          this.cfResolve = () => {
            win.webContents.once('did-finish-load', () => resolve())
            win.loadURL(url)
          }
          this.cfTimeout = setTimeout(() => {
            this.cfResolve = null
            reject(new Error('Comix.to: re-challenge timed out'))
          }, CHALLENGE_TIMEOUT_MS)
          return
        }
        resolve()
      }

      win.webContents.once('did-finish-load', onLoad)
      win.loadURL(url)
    })

    // Page is loaded — read fresh XSRF-TOKEN from session cookie store (bypasses HttpOnly restriction)
    const xsrfCookies = await this.getSession().cookies.get({
      domain: 'comix.to',
      name: 'XSRF-TOKEN'
    })
    const xsrf = xsrfCookies.length > 0 ? decodeURIComponent(xsrfCookies[0].value) : ''
    console.log(
      '[comixto] post-nav XSRF-TOKEN:',
      xsrf ? `found (${xsrf.length} chars)` : 'NOT FOUND in session'
    )
    const script = scriptTemplate.replace(
      placeholder,
      `var __INJECTED_XSRF__ = ${JSON.stringify(xsrf)};`
    )

    try {
      const result = (await win.webContents.executeJavaScript(script)) as T
      win.loadURL('about:blank')
      return result
    } catch (e) {
      win.loadURL('about:blank')
      throw e
    }
  }

  /** Navigate to the manga page, capture the signed chapters API request via CDP,
   *  then use the extracted auth token to directly fetch all remaining pages. */
  async navigateAndCaptureChapters(mangaId: string, timeoutMs = 60_000): Promise<unknown> {
    await this.challengeSession()
    const win = this.ensureWindow()
    const dbg = win.webContents.debugger
    const pageUrl = `${BASE_URL}/title/${mangaId}`
    // Hash ID is the part before the first '-' in the slug (e.g. 'p704' from 'p704-sss-grade-saint-knight')
    const mangaHashId = mangaId.split('-')[0]

    if (!dbg.isAttached()) dbg.attach('1.3')
    await dbg.sendCommand('Network.enable')

    return new Promise<unknown>((resolve) => {
      let capturedToken: string | null = null
      let allItems: unknown[] = []
      let resolved = false

      const timer = setTimeout(() => {
        if (resolved) return
        console.log('[comixto] CDP capture timed out, collected', allItems.length, 'chapters')
        cleanup()
        resolve(allItems.length > 0 ? { result: { items: allItems } } : null)
      }, timeoutMs)

      const requestMap = new Map<string, boolean>()
      const scrollTimers: ReturnType<typeof setTimeout>[] = []

      function cleanup() {
        resolved = true
        clearTimeout(timer)
        for (const t of scrollTimers) clearTimeout(t)
        scrollTimers.length = 0
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (self.cancelCapture === cancel) self.cancelCapture = null
        if (!win.isDestroyed()) {
          dbg.removeListener('message', onMsg)
          dbg.sendCommand('Network.disable').catch(() => {})
          win.loadURL('about:blank')
        }
      }
      function cancel() {
        if (!resolved) {
          cleanup()
          resolve(null)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this
      this.cancelCapture = cancel

      async function fetchRemainingPages() {
        // Use limit=100 to minimize requests; stop when response is empty
        let page = 2
        while (!resolved && !win.isDestroyed()) {
          let items: unknown[] = []
          try {
            const url = `/api/v2/manga/${mangaHashId}/chapters?limit=100&page=${page}&order[number]=desc&time=1&_=${capturedToken}`
            const data = (await win.webContents.executeJavaScript(
              `fetch(${JSON.stringify(url)}, { credentials: 'include' }).then(r => r.json()).catch(() => null)`
            )) as { result?: { items?: unknown[] } } | null
            items = data?.result?.items ?? []
            if (items.length > 0) allItems = allItems.concat(items)
            console.log(
              '[comixto] fetched page',
              page,
              '— got',
              items.length,
              'items, total:',
              allItems.length
            )
          } catch (e) {
            console.log('[comixto] page', page, 'fetch error:', String(e))
          }
          if (items.length === 0) break
          page++
        }
        if (!resolved) {
          cleanup()
          resolve({ result: { items: allItems } })
        }
      }

      const onMsg = (_e: Electron.Event, method: string, params: Record<string, unknown>) => {
        if (method === 'Network.requestWillBeSent') {
          const req = params.request as { url: string }
          if (req?.url?.includes(`/manga/${mangaHashId}/chapters`)) {
            console.log('[comixto] CDP saw chapters request:', req.url)
            requestMap.set(params.requestId as string, true)
            if (!capturedToken) {
              const m = req.url.match(/[?&]_=([^&]+)/)
              if (m) {
                capturedToken = m[1]
                console.log('[comixto] CDP captured auth token')
              }
            }
          }
        }
        if (method === 'Network.loadingFinished' && requestMap.has(params.requestId as string)) {
          const reqId = params.requestId as string
          requestMap.delete(reqId)
          dbg
            .sendCommand('Network.getResponseBody', { requestId: reqId })
            .then(async (body: { body: string }) => {
              if (resolved) return
              // Log full first item to see all available fields (for debugging URL format)
              try {
                const parsed = JSON.parse(body.body) as { result?: { items?: unknown[] } }
                const items = parsed?.result?.items ?? []
                if (items.length > 0)
                  console.log('[comixto] CDP chapter item[0]:', JSON.stringify(items[0]))
              } catch {
                /* ignore */
              }
              console.log('[comixto] CDP captured page 1 body:', body.body.slice(0, 600))
              try {
                const data = JSON.parse(body.body) as {
                  result?: { items?: unknown[]; pagination?: { last_page?: number } }
                  pagination?: { last_page?: number }
                }
                const items = data?.result?.items ?? []
                const lastPage =
                  data?.result?.pagination?.last_page ?? data?.pagination?.last_page ?? 0
                allItems = allItems.concat(items)
                console.log('[comixto] page 1 items:', allItems.length, 'lastPage:', lastPage)
                // Remove CDP listener NOW so fetchRemainingPages\'s executeJavaScript fetches aren\'t double-captured
                dbg.removeListener('message', onMsg)
                dbg.sendCommand('Network.disable').catch(() => {})
                if (lastPage <= 1 && items.length < 20) {
                  cleanup()
                  resolve({ result: { items: allItems } })
                } else {
                  await fetchRemainingPages()
                }
              } catch {
                cleanup()
                resolve(null)
              }
            })
            .catch(() => {
              cleanup()
              resolve(null)
            })
        }
      }
      dbg.on('message', onMsg)

      win.webContents.once('did-finish-load', () => {
        const loadedUrl = win.webContents.getURL()
        console.log('[comixto] CDP page loaded url=' + loadedUrl + ' title=' + win.getTitle())
        const isCF = CF_INDICATORS.some((s) => loadedUrl.includes(s))
        console.log('[comixto] CDP isCF=' + isCF + ', scrolling to trigger chapter load...')
        // Log first few chapter link URLs after React renders (delayed)
        scrollTimers.push(
          setTimeout(() => {
            if (!win.isDestroyed()) {
              win.webContents
                .executeJavaScript(
                  `Array.from(document.querySelectorAll('a[href*="/chapter"]')).slice(0,5).map(a=>a.href)`
                )
                .then((links: unknown) =>
                  console.log('[comixto] DOM chapter links:', JSON.stringify(links))
                )
                .catch(() => {})
            }
          }, 5000)
        )
        const scroll = () => {
          if (!win.isDestroyed()) {
            win.webContents
              .executeJavaScript(
                'window.scrollTo(0, document.body.scrollHeight); document.body.scrollHeight'
              )
              .then((h) => console.log('[comixto] CDP scrolled, height=' + h))
              .catch(() => {})
          }
        }
        scrollTimers.push(setTimeout(scroll, 1500))
        scrollTimers.push(setTimeout(scroll, 4000))
      })

      win.loadURL(pageUrl)
    })
  }

  destroy(): void {
    this.clearCfTimeout()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }
}

export const comixBrowser = new ComixBrowser()
