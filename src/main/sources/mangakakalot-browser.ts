import { BrowserWindow, session } from 'electron'

const PARTITION = 'persist:mangakakalot'
const NAV_TIMEOUT_MS = 45_000
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export class MangakakalotBrowser {
  private win: BrowserWindow | null = null

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win
    this.win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        session: session.fromPartition(PARTITION),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    this.win.on('closed', () => { this.win = null })
    return this.win
  }

  /**
   * Navigate to url, wait until we land on a mangakakalot.tv page
   * (parklogic redirects via window.location.replace → second did-finish-load),
   * then run the extraction script.
   */
  async navigateAndRun<T>(url: string, script: string): Promise<T> {
    const win = this.ensureWindow()

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        win.webContents.removeListener('did-finish-load', onLoad)
        if (err) reject(err)
        else resolve()
      }

      const timeout = setTimeout(
        () => done(new Error(`Mangakakalot: timed out loading ${url}`)),
        NAV_TIMEOUT_MS
      )

      const onLoad = () => {
        const current = win.webContents.getURL()
        // Resolve once we're on the actual mangakakalot domain, not the parklogic redirect stub
        if (current.includes('mangakakalot.tv') && !current.startsWith('about:')) {
          done()
        }
        // If still on parklogic / redirect page, keep waiting for the next did-finish-load
      }

      win.webContents.on('did-finish-load', onLoad)
      win.loadURL(url, { userAgent: CHROME_UA })
    })

    try {
      return await win.webContents.executeJavaScript(script) as T
    } finally {
      win.loadURL('about:blank')
    }
  }

  destroy(): void {
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }
}

export const mangakakalotBrowser = new MangakakalotBrowser()
