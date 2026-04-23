# OpenComic V2

A modern desktop comic reader and library manager built with Electron, React, and TypeScript. Read local comics from your file system or browse and read from online sources — all in one app.

## Features

- **Local Library** — Scan folders for CBZ, CBR, PDF, and EPUB files. View covers, metadata (series, issue number, publisher, year, genres), and pick up where you left off.
- **Comic Reader** — Page-by-page reading with persistent progress tracking. Open multiple comics in tabs simultaneously.
- **Online Sources** — Browse, search, and read from Comix.to, Mangakakalot, and ReadAllComics directly within the app.
- **Persistent Storage** — Reading progress and library metadata stored in a local SQLite database.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 39 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Database | better-sqlite3 (SQLite, WAL mode) |
| Build | electron-vite + Vite 7 |
| Testing | Vitest + Testing Library |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

This starts the Electron app with hot reload enabled.

### Build

```bash
# Build for your current platform
npm run build

# Platform-specific builds
npm run build:mac
npm run build:win
npm run build:linux
```

Built artifacts are output to `out/`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Build and package the app |
| `npm run test` | Run all tests |
| `npm run test:main` | Run main process tests only |
| `npm run test:renderer` | Run renderer tests only |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check both main and renderer |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run rebuild` | Rebuild native modules (better-sqlite3) |

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── ipc/handlers.ts    # IPC channel handlers
│   ├── library/scanner.ts # File system scanner
│   ├── readers/cbz.ts     # CBZ extraction
│   ├── protocol/          # comic-page:// custom protocol
│   ├── sources/           # Online source providers
│   └── storage/           # SQLite database & queries
├── renderer/src/          # React UI
│   ├── pages/             # Library, Sources, Reader
│   ├── components/        # Shared UI components
│   ├── store/             # Zustand stores
│   └── hooks/             # IPC and data hooks
├── shared/                # Types shared between processes
│   ├── types/             # Comic, source, and progress types
│   └── ipc/types.ts       # IPC channel definitions
└── preload/               # Secure context bridge
tests/
├── main/                  # Main process unit tests
└── renderer/              # Component and hook tests
```

## Architecture

The app follows standard Electron architecture with a strict IPC boundary between the main process (Node.js) and renderer process (browser/React):

- **Main process** handles file I/O, database access, and network requests to online sources.
- **Renderer process** is a sandboxed React app that communicates with main exclusively over typed IPC channels.
- A custom `comic-page://` protocol serves comic page images from local CBZ files to the renderer without exposing raw file paths.
- Online sources use a pluggable provider pattern, making it straightforward to add new sources.

## Database

The app stores data in `opencomic.db` in the user's app data directory.

| Table | Purpose |
|---|---|
| `comics` | Library metadata: path, title, series, cover, format, page count |
| `reading_progress` | Per-comic current page, total pages, completion status |
| `settings` | Key-value app settings |

## Adding Online Sources

Online sources live in `src/main/sources/`. Each source implements the `SourceProvider` interface defined in `src/shared/types/source.ts` and is registered in `src/main/sources/index.ts`.
