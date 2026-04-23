import { describe, test, expect, vi } from 'vitest'
import { parseEncryptionKey, xorDecrypt, createMangaPlusProvider } from '../../../src/main/sources/mangaplus'

// ── Protobuf encoding helpers ────────────────────────────────────────────────

function encodeVarint(v: number): number[] {
  const out: number[] = []
  while (v > 0x7f) { out.push((v & 0x7f) | 0x80); v >>>= 7 }
  out.push(v & 0x7f)
  return out
}
function encodeInt(field: number, v: number): number[] {
  return [...encodeVarint((field << 3) | 0), ...encodeVarint(v)]
}
function encodeBytes(field: number, bytes: number[]): number[] {
  return [...encodeVarint((field << 3) | 2), ...encodeVarint(bytes.length), ...bytes]
}
function encodeString(field: number, s: string): number[] {
  return encodeBytes(field, Array.from(Buffer.from(s, 'utf8')))
}

// Real structure (from live API inspection):
// root.field1 = SuccessResult
// SuccessResult.field25 = AllTitlesViewV2
// AllTitlesViewV2.field1 (repeated) = OuterTitle
// OuterTitle.field2 = InnerTitle
// InnerTitle: field1=id(int), field2=name(str), field4=coverUrl(str)
function buildAllV2(titles: Array<{ id: number; title: string; coverUrl: string }>): Uint8Array {
  const outerTitles = titles.flatMap(t => {
    const innerTitle = [...encodeInt(1, t.id), ...encodeString(2, t.title), ...encodeString(4, t.coverUrl)]
    const outerTitle = encodeBytes(2, innerTitle) // OuterTitle.field2 = InnerTitle
    return encodeBytes(1, outerTitle) // AllTitlesViewV2.field1 = OuterTitle (repeated)
  })
  const allTitlesViewBytes = outerTitles // all outer titles concatenated
  const successBytes = encodeBytes(25, allTitlesViewBytes) // SuccessResult.field25 = AllTitlesViewV2
  return new Uint8Array(encodeBytes(1, successBytes)) // root.field1 = SuccessResult
}

// Real structure (from live API inspection):
// root.field1 = SuccessResult
// SuccessResult.field8 = TitleDetail
// TitleDetail.field1 = Title (field1=id, field2=name, field7=description)
// TitleDetail.field28 (repeated) = ChapterGroup
// ChapterGroup.field2 (repeated) = Chapter
// Chapter: field2=chapterId(int), field3=number(str), field4=title(str), field6=timestamp(int)
function buildTitleDetail(id: number, title: string, description: string, chapters: Array<{ id: number; num: string }>): Uint8Array {
  const chapterGroupBytes = chapters.flatMap(ch => {
    const chapterBytes = [...encodeInt(2, ch.id), ...encodeString(3, ch.num)]
    return encodeBytes(2, chapterBytes) // ChapterGroup.field2 = Chapter (repeated)
  })
  const titleBytes = [...encodeInt(1, id), ...encodeString(2, title), ...encodeString(7, description)]
  const detailBytes = [...encodeBytes(1, titleBytes), ...encodeBytes(28, chapterGroupBytes)]
  const successBytes = encodeBytes(8, detailBytes) // SuccessResult.field8 = TitleDetail
  return new Uint8Array(encodeBytes(1, successBytes)) // root.field1 = SuccessResult
}

// Real structure (from live API inspection):
// root.field1 = SuccessResult
// SuccessResult.field10 = Viewer
// Viewer.field1 (repeated) = PageWrapper
// PageWrapper.field1 = MangaPage
// MangaPage: field1=url(str), field5=keyHex(str)
function buildViewerResponse(pages: Array<{ url: string; keyHex: string }>): Uint8Array {
  const viewerMsgBytes = pages.flatMap(p => {
    const mpBytes = [...encodeString(1, p.url), ...encodeString(5, p.keyHex)] // MangaPage msg
    const pageMsgBytes = encodeBytes(1, mpBytes) // PageWrapper: field1 = MangaPage
    return encodeBytes(1, pageMsgBytes) // Viewer.field1 (repeated) = PageWrapper
  })
  const successMsgBytes = encodeBytes(10, viewerMsgBytes) // SuccessResult.field10 = Viewer
  return new Uint8Array(encodeBytes(1, successMsgBytes)) // root.field1 = SuccessResult
}

// ── Pure utility tests ───────────────────────────────────────────────────────

describe('parseEncryptionKey', () => {
  test('parses hex string to Uint8Array', () => {
    expect(parseEncryptionKey('0a0b0c')).toEqual(new Uint8Array([10, 11, 12]))
  })

  test('returns empty array for empty string', () => {
    expect(parseEncryptionKey('')).toEqual(new Uint8Array([]))
  })

  test('throws for odd-length hex', () => {
    expect(() => parseEncryptionKey('abc')).toThrow('malformed')
  })
})

describe('xorDecrypt', () => {
  test('XORs each byte with key cycling', () => {
    const data = Buffer.from([0x01, 0x02, 0x03, 0x04])
    const key = new Uint8Array([0x0f, 0x0f])
    expect(Array.from(xorDecrypt(data, key))).toEqual([0x0e, 0x0d, 0x0c, 0x0b])
  })

  test('returns data unchanged when key is empty', () => {
    const data = Buffer.from([0xaa, 0xbb])
    expect(Array.from(xorDecrypt(data, new Uint8Array([])))).toEqual([0xaa, 0xbb])
  })
})

// ── Provider factory tests ───────────────────────────────────────────────────

describe('createMangaPlusProvider', () => {
  test('returns provider with id "mangaplus"', () => {
    expect(createMangaPlusProvider(vi.fn()).id).toBe('mangaplus')
  })

  test('browse returns series from allV2 protobuf response', async () => {
    const mockBytes = buildAllV2([{ id: 1, title: 'One Piece', coverUrl: 'https://example.com/cover.jpg' }])
    const fetcher = vi.fn().mockResolvedValue(new Response(mockBytes, { status: 200 }))
    const results = await createMangaPlusProvider(fetcher).browse()
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ id: '1', title: 'One Piece', coverUrl: 'https://example.com/cover.jpg' })
  })

  test('browse returns empty array when no titles in response', async () => {
    const mockBytes = new Uint8Array(encodeBytes(1, []))
    const fetcher = vi.fn().mockResolvedValue(new Response(mockBytes, { status: 200 }))
    const results = await createMangaPlusProvider(fetcher).browse()
    expect(results).toEqual([])
  })

  test('search filters by case-insensitive query', async () => {
    const mockBytes = buildAllV2([
      { id: 1, title: 'One Piece', coverUrl: '' },
      { id: 2, title: 'Naruto', coverUrl: '' }
    ])
    const fetcher = vi.fn().mockResolvedValue(new Response(mockBytes, { status: 200 }))
    const results = await createMangaPlusProvider(fetcher).search('piece')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('One Piece')
  })

  test('getSeries returns detail with chapters', async () => {
    const mockBytes = buildTitleDetail(42, 'Bleach', 'Soul Reapers', [{ id: 101, num: '1' }])
    const fetcher = vi.fn().mockResolvedValue(new Response(mockBytes, { status: 200 }))
    const detail = await createMangaPlusProvider(fetcher).getSeries('42')
    expect(detail.title).toBe('Bleach')
    expect(detail.description).toBe('Soul Reapers')
    expect(detail.chapters).toHaveLength(1)
    expect(detail.chapters[0]).toMatchObject({ id: '101', number: '1' })
  })

  test('getChapterPages returns page entries with decryption keys', async () => {
    const mockBytes = buildViewerResponse([{ url: 'https://example.com/p1.jpg', keyHex: '0a0b' }])
    const fetcher = vi.fn().mockResolvedValue(new Response(mockBytes, { status: 200 }))
    const pages = await createMangaPlusProvider(fetcher).getChapterPages('101')
    expect(pages).toHaveLength(1)
    expect(pages[0].url).toBe('https://example.com/p1.jpg')
    expect(pages[0].decryptionKey).toEqual(new Uint8Array([10, 11]))
  })
})
