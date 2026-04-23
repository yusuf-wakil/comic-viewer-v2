import { readdir } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { createHash } from 'node:crypto'
import type { Comic } from '@shared/types/comic'

const SUPPORTED_EXTENSIONS = new Set(['.cbz', '.cbr', '.pdf', '.epub'])

function formatFromExt(ext: string): Comic['format'] | null {
  switch (ext.toLowerCase()) {
    case '.cbz': return 'cbz'
    case '.cbr': return 'cbr'
    case '.pdf': return 'pdf'
    case '.epub': return 'epub'
    default: return null
  }
}

function idFromPath(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex').slice(0, 16)
}

function titleFromFilename(filePath: string): string {
  return basename(filePath, extname(filePath))
}

async function walk(dir: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  await Promise.all(entries.map(async entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, results)
    } else if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push(full)
    }
  }))
}

export async function scanFolder(folderPath: string): Promise<Comic[]> {
  const filePaths: string[] = []
  await walk(folderPath, filePaths)

  return filePaths.map(filePath => {
    const ext = extname(filePath)
    const format = formatFromExt(ext)!
    return {
      id: idFromPath(filePath),
      path: filePath,
      title: titleFromFilename(filePath),
      series: '',
      issueNumber: null,
      coverPath: null,
      format,
      pageCount: 0,
      publisher: null,
      year: null,
      genres: [],
      addedAt: Date.now()
    }
  })
}
