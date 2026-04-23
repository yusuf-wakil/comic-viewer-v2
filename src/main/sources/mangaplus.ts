import protobuf from 'protobufjs'
import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry, Fetcher } from '@shared/types/source'

const BASE_URL = 'https://jumpg-webapi.tokyo-cdn.com/api'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
  'Referer': 'https://mangaplus.shueisha.co.jp'
}

export function parseEncryptionKey(hex: string): Uint8Array {
  if (!hex) return new Uint8Array([])
  if (hex.length % 2 !== 0) throw new Error(`MangaPlus: malformed encryption key: ${hex}`)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function xorDecrypt(data: Buffer, key: Uint8Array): Buffer {
  if (!key.length) return data
  const out = Buffer.allocUnsafe(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length]
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readFields(bytes: Uint8Array): Map<number, any[]> {
  const reader = protobuf.Reader.create(bytes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = new Map<number, any[]>()
  try {
    while (reader.pos < reader.len) {
      const tag = reader.uint32()
      const fieldNumber = tag >>> 3
      const wireType = tag & 0x7
      let value: unknown = null
      switch (wireType) {
        case 0: value = reader.int64(); break
        case 1: reader.skip(8); break
        case 2: value = reader.bytes(); break
        case 5: reader.skip(4); break
        default: reader.skipType(wireType)
      }
      if (value !== null) {
        if (!fields.has(fieldNumber)) fields.set(fieldNumber, [])
        fields.get(fieldNumber)!.push(value)
      }
    }
  } catch { /* partial message — return what we have */ }
  return fields
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nested(fields: Map<number, any[]>, n: number): Uint8Array | null {
  const v = fields.get(n)
  return v?.length ? (v[0] as Uint8Array) : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(fields: Map<number, any[]>, n: number): string {
  const v = fields.get(n)
  if (!v?.length) return ''
  const val = v[0]
  return val instanceof Uint8Array ? Buffer.from(val).toString('utf8') : String(val)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function int(fields: Map<number, any[]>, n: number): number {
  const v = fields.get(n)
  if (!v?.length) return 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val = v[0] as any
  return typeof val === 'number' ? val : (val?.toNumber?.() ?? 0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function repeated(fields: Map<number, any[]>, n: number): Uint8Array[] {
  return (fields.get(n) ?? []) as Uint8Array[]
}

export function createMangaPlusProvider(fetcher: Fetcher = globalThis.fetch): SourceProvider {
  async function fetchProto(url: string): Promise<Uint8Array> {
    const resp = await fetcher(url, { headers: HEADERS })
    if (!resp.ok) throw new Error(`MangaPlus API error: ${resp.status}`)
    return new Uint8Array(await resp.arrayBuffer())
  }

  // Returns inner Title bytes (field1=id, field2=name, field3=author, field4=coverUrl)
  async function fetchAllTitles(): Promise<Uint8Array[]> {
    const bytes = await fetchProto(`${BASE_URL}/title_list/allV2`)
    const root = readFields(bytes)
    const successBytes = nested(root, 1)
    if (!successBytes) return []
    const sf = readFields(successBytes)
    // AllTitlesViewV2 is at field 25 of SuccessResult
    const allTitlesBytes = nested(sf, 25)
    if (!allTitlesBytes) return []
    // Each outer title at field1 wraps an inner Title at field2
    return repeated(readFields(allTitlesBytes), 1)
      .map(tb => nested(readFields(tb), 2))
      .filter((b): b is Uint8Array => b !== null)
  }

  return {
    id: 'mangaplus',

    async browse(page = 1): Promise<SeriesResult[]> {
      const titleBytesList = await fetchAllTitles()
      const pageSize = 20
      return titleBytesList.slice((page - 1) * pageSize, page * pageSize).map(tb => {
        const t = readFields(tb)
        // field1=id, field2=name, field4=portrait thumbnail URL
        return { id: String(int(t, 1)), title: str(t, 2), coverUrl: str(t, 4) }
      })
    },

    async search(query: string): Promise<SeriesResult[]> {
      const titleBytesList = await fetchAllTitles()
      const q = query.toLowerCase()
      const results: SeriesResult[] = []
      for (const tb of titleBytesList) {
        const t = readFields(tb)
        const title = str(t, 2)
        if (title.toLowerCase().includes(q)) {
          results.push({ id: String(int(t, 1)), title, coverUrl: str(t, 4) })
        }
      }
      return results.slice(0, 50)
    },

    async getSeries(id: string): Promise<SeriesDetail> {
      const bytes = await fetchProto(`${BASE_URL}/title_detailV3?title_id=${id}`)
      const root = readFields(bytes)
      const successBytes = nested(root, 1)
      if (!successBytes) throw new Error('MangaPlus: title detail not found')
      const sf = readFields(successBytes)
      // TitleDetail is at field 8 of SuccessResult
      const detailBytes = nested(sf, 8)
      if (!detailBytes) throw new Error('MangaPlus: detail object missing')
      const df = readFields(detailBytes)
      const titleBytes = nested(df, 1)
      if (!titleBytes) throw new Error('MangaPlus: title object missing')
      const t = readFields(titleBytes)
      const chapters: ChapterEntry[] = []
      const seen = new Set<string>()
      // Chapter groups at field 28; each group has chapters at field2 (free) and field3 (all/locked)
      for (const cgBytes of repeated(df, 28)) {
        const cgf = readFields(cgBytes)
        for (const cb of [...repeated(cgf, 2), ...repeated(cgf, 3)]) {
          const cf = readFields(cb)
          // chapter: field2=chapterId, field3=number, field4=title, field6=startDate
          const chId = String(int(cf, 2))
          if (!chId || chId === '0' || seen.has(chId)) continue
          seen.add(chId)
          const ts = int(cf, 6)
          chapters.push({
            id: chId,
            number: str(cf, 3),
            title: str(cf, 4),
            date: ts ? new Date(ts * 1000).toISOString() : ''
          })
        }
      }
      return {
        id,
        title: str(t, 2),
        coverUrl: str(t, 4),
        description: str(t, 7),
        genres: [],
        chapters
      }
    },

    async getChapterPages(chapterId: string): Promise<PageEntry[]> {
      const bytes = await fetchProto(`${BASE_URL}/manga_viewer?chapter_id=${chapterId}&split=no&img_quality=high`)
      const root = readFields(bytes)
      const successBytes = nested(root, 1)
      if (!successBytes) throw new Error('MangaPlus: manga viewer not found')
      const sf = readFields(successBytes)
      // Viewer is at field 10 of SuccessResult
      const viewerBytes = nested(sf, 10)
      if (!viewerBytes) throw new Error('MangaPlus: viewer missing')
      const pages: PageEntry[] = []
      for (const pb of repeated(readFields(viewerBytes), 1)) {
        const pf = readFields(pb)
        // Each page wrapper has the MangaPage at field 1
        const mangaPageBytes = nested(pf, 1)
        if (!mangaPageBytes) continue
        const mpf = readFields(mangaPageBytes)
        // MangaPage: field1=url, field5=encryptionKeyHex
        const imageUrl = str(mpf, 1)
        const keyHex = str(mpf, 5)
        if (!imageUrl) continue
        pages.push({ url: imageUrl, decryptionKey: keyHex ? parseEncryptionKey(keyHex) : undefined })
      }
      return pages
    }
  }
}
