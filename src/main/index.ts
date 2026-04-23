import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { registerComicPageProtocol } from './protocol/comic-page'
import { registerHandlers } from './ipc/handlers'
import { comixBrowser } from './sources/comixto-browser'
import { mangakakalotBrowser } from './sources/mangakakalot-browser'

app.whenReady().then(() => {
  // Inject Referer header for MangaPlus CDN so cover/page images load correctly
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://jumpg-assets.tokyo-cdn.com/*'] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Referer': 'https://mangaplus.shueisha.co.jp'
        }
      })
    }
  )

  registerComicPageProtocol()
  registerHandlers()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  })

  win.once('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
})

app.on('before-quit', () => { comixBrowser.destroy(); mangakakalotBrowser.destroy() })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
