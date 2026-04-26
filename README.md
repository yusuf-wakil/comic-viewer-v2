# OpenComic

[![CI](https://github.com/yusuf-wakil/comic-viewer-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/yusuf-wakil/comic-viewer-v2/actions/workflows/ci.yml)

A desktop comic reader and library manager built with Electron, React, and TypeScript. Read local comics from your file system or browse and stream from online sources — all in one app.

---

## Installation (macOS)

1. Download `opencomic-1.0.0.dmg` from the [latest release](https://github.com/yusuf-wakil/comic-viewer-v2/releases).
2. Open the DMG and drag **OpenComic** into your Applications folder.
3. On first launch, macOS may block the app because it is not notarized. To open it:
   - Right-click the app in Finder and choose **Open**, then confirm.
   - Or go to **System Settings → Privacy & Security** and click **Open Anyway**.

---

## Features

- **Local library** — scan folders for CBZ/CBR comic archives, track reading progress per issue.
- **Online sources** — browse, search, and read from Comix.to and YSK Comics directly inside the app.
- **Page & scroll modes** — toggle between paginated and continuous scroll reading views.
- **Dark theme** — full dark UI with token-based theming.
- **Starred series** — save series from online sources to your library for quick access.

---

## Development Setup

**Requirements:** Node.js 18+, npm.

```bash
# Install dependencies
npm install

# Rebuild native modules (required on first install and after Node version changes)
npm run rebuild

# Start in development mode with hot reload
npm run dev
```

> If you see an error about `better-sqlite3` being compiled against a different Node version, run `npm run rebuild` to recompile it for your current Node.

---

## Building

### macOS (produces a `.dmg`)

```bash
npm run build:mac
```

Output: `dist/opencomic-1.0.0.dmg`

The build is ad-hoc signed (no Apple Developer certificate required). The resulting DMG works on your own machine without restriction. On other Macs, users will need to right-click → Open to bypass Gatekeeper on first launch.

### Windows

```bash
npm run build:win
```

Output: `dist/opencomic-v2-1.0.0-setup.exe`

### Linux

```bash
npm run build:linux
```

Output: AppImage, Snap, and `.deb` in `dist/`.

### Build output directories

| Path | Contents |
|---|---|
| `out/` | Compiled JS/CSS from `electron-vite` (intermediate) |
| `dist/` | Final packaged app and installer |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build:mac` | Compile and package for macOS (DMG) |
| `npm run build:win` | Compile and package for Windows (NSIS installer) |
| `npm run build:linux` | Compile and package for Linux (AppImage/deb/snap) |
| `npm run test` | Run all tests (main + renderer) |
| `npm run test:main` | Run main process tests only |
| `npm run test:renderer` | Run renderer/component tests only |
| `npm run test:watch` | Run main process tests in watch mode |
| `npm run typecheck` | Type-check both main and renderer |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run rebuild` | Rebuild native modules (better-sqlite3) for current Node/Electron |

---

## Project Structure

```
src/
├── main/                  # Electron main process (Node.js)
│   ├── ipc/handlers.ts    # IPC channel handlers
│   ├── library/scanner.ts # File system scanner for local comics
│   ├── readers/cbz.ts     # CBZ extraction via unzipper
│   ├── protocol/          # comic-page:// custom protocol for serving pages
│   ├── sources/           # Online source providers (Comix.to, YSK Comics)
│   └── storage/           # SQLite database, migrations, and queries
├── renderer/src/          # React UI (sandboxed browser context)
│   ├── pages/             # Library, Sources, Reader pages
│   ├── components/        # Shared UI components
│   ├── store/             # Zustand stores (library, sources, favorites, history)
│   └── hooks/             # IPC bridge and data hooks
├── shared/                # Types shared across processes
│   ├── types/             # Comic, source, progress, and IPC types
│   └── ipc/types.ts       # Typed IPC channel definitions
└── preload/               # Context bridge (exposes window.ipc to renderer)
tests/
├── main/                  # Main process unit tests (Vitest, real SQLite)
└── renderer/              # Component and hook tests (Vitest + jsdom + RTL)
```

---

## Architecture

The app follows standard Electron architecture with a strict IPC boundary:

- **Main process** handles all file I/O, SQLite access, and network requests. It never exposes raw file paths to the renderer.
- **Renderer process** is a sandboxed React app that talks to main exclusively through typed IPC channels defined in `src/shared/ipc/types.ts`.
- A custom `comic-page://` protocol serves individual comic page images from local CBZ files, so the renderer loads pages as normal `<img>` URLs without file system access.
- Online sources implement the `SourceProvider` interface (`src/main/sources/index.ts`) — adding a new source means implementing four methods: `browse`, `search`, `getSeries`, and `getChapterPages`.

---

## Database

Stored in `opencomic.db` in the OS app-data directory (`~/Library/Application Support/OpenComic/` on macOS).

| Table | Purpose |
|---|---|
| `comics` | Library metadata: path, title, series, cover URL, format, page count |
| `reading_progress` | Per-comic current page, total pages, last-read timestamp |
| `settings` | Key-value app configuration |

---

## Adding Online Sources

1. Create `src/main/sources/mysource.ts` implementing the `SourceProvider` interface.
2. Register it in `src/main/index.ts` with `register(mySourceProvider)`.
3. Add the source ID to the `SourceId` union in `src/shared/types/source.ts`.
4. Add a display label in `src/renderer/src/pages/Sources.tsx` → `SOURCE_LABELS`.

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on submitting issues and pull requests.

## Changelog

See [CHANGELOG.md](docs/CHANGELOG.md) for release history.

## License

MIT — see [LICENSE](LICENSE).
