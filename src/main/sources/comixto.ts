import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry } from '@shared/types/source'
import { net } from 'electron'
import { comixBrowser } from './comixto-browser'

const BASE_URL = 'https://comix.to'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
}

function posterUrl(poster: unknown): string {
  if (!poster) return ''
  if (typeof poster === 'string') return poster
  if (typeof poster === 'object') {
    const p = poster as Record<string, string>
    return p['medium'] ?? p['large'] ?? p['small'] ?? ''
  }
  return ''
}

/** Public search/browse APIs work without CF cookies — use plain net.fetch. */
async function directGet<T>(path: string): Promise<T> {
  const resp = await net.fetch(`${BASE_URL}${path}`, { headers: HEADERS })
  if (!resp.ok) throw new Error(`Comix.to API ${resp.status}: ${path}`)
  return resp.json() as Promise<T>
}

/** Endpoints that need CF clearance + XSRF auth (chapters list). */
async function sessionGet<T>(path: string): Promise<T> {
  const xsrfCookies = await comixBrowser
    .getSession()
    .cookies.get({ domain: 'comix.to', name: 'XSRF-TOKEN' })
  const xsrf = xsrfCookies.length > 0 ? decodeURIComponent(xsrfCookies[0].value) : null
  console.log('[comixto] sessionGet xsrf_present=' + !!xsrf + (xsrf ? ' len=' + xsrf.length : ''))
  const headers: Record<string, string> = {
    ...HEADERS,
    Accept: 'application/json',
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL
  }
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  const resp = await comixBrowser.fetch(`${BASE_URL}${path}`, { headers })
  if (!resp.ok) throw new Error(`Comix.to API ${resp.status}: ${path}`)
  const data = (await resp.json()) as T
  const s = (data as Record<string, unknown>)?.['status']
  console.log('[comixto] sessionGet status=' + resp.status + ' body_status=' + s)
  return data
}

interface MangaItem {
  hash_id?: string
  id?: string
  slug?: string
  title: string
  poster: unknown
  last_chapter?: number | string
  latest_chapter?: number | string
  chapter?: number | string
  rating?: number | string
  score?: number | string
  views?: number
  updated_at?: number | string
  chapter_updated_at?: number | string
}

function extractItems(data: unknown): MangaItem[] {
  if (Array.isArray(data)) return data as MangaItem[]
  const d = data as { result?: unknown; items?: unknown; data?: unknown }
  if (Array.isArray(d.result)) return d.result as MangaItem[]
  if (d.result && typeof d.result === 'object' && !Array.isArray(d.result)) {
    const r = d.result as { items?: unknown; data?: unknown }
    if (Array.isArray(r.items)) return r.items as MangaItem[]
    if (Array.isArray(r.data)) return r.data as MangaItem[]
  }
  if (Array.isArray(d.items)) return d.items as MangaItem[]
  if (Array.isArray(d.data)) return d.data as MangaItem[]
  return []
}

// Fetches chapters using in-page fetch (carries session cookies + correct Origin, bypasses CSRF/auth)
// Falls back to DOM link scraping if the API call fails
/* eslint-disable no-useless-escape */
const SERIES_SCRIPT = `
(function() {
  console.log('[comixto-browser] SERIES_SCRIPT start url=' + location.href + ' cookie_len=' + document.cookie.length);
  var idMatch = location.pathname.match(/\/manga\/([^/]+)|\/title\/([^/\-]+)/);
  const id = idMatch ? (idMatch[1] || idMatch[2]) : '';
  console.log('[comixto-browser] extracted id=' + id + ' from ' + location.pathname);
  if (!id) return Promise.resolve([]);

  function mapItems(items) {
    return items.map(function(c) {
      var dateVal = c.created_at || c.date || '';
      var dateStr = typeof dateVal === 'number'
        ? new Date(dateVal * 1000).toISOString().slice(0, 10)
        : String(dateVal).slice(0, 10);
      return {
        url: 'https://comix.to/chapter/' + (c.hash_id || c.id || c.chapter_id || ''),
        hash_id: String(c.hash_id || c.id || c.chapter_id || ''),
        title: c.title || '',
        number: String(c.chapter || c.chapter_number || c.number || ''),
        date: dateStr,
      };
    });
  }

  // Try __NEXT_DATA__ SSR chapter data first — chapters are SSR'd, not fetched client-side
  function fromNextData() {
    try {
      var nd = document.getElementById('__NEXT_DATA__');
      if (!nd) { console.log('[comixto-browser] no __NEXT_DATA__ element'); return null; }
      var data = JSON.parse(nd.textContent || '{}');
      var pp = data.props && data.props.pageProps;
      if (!pp) { console.log('[comixto-browser] __NEXT_DATA__ no pageProps, top keys=' + JSON.stringify(Object.keys(data))); return null; }
      console.log('[comixto-browser] __NEXT_DATA__ pageProps keys=' + JSON.stringify(Object.keys(pp)));
      var directKeys = ['chapters', 'chapter_list', 'chapterList', 'seriesChapters', 'chapterData'];
      for (var i = 0; i < directKeys.length; i++) {
        var arr = pp[directKeys[i]];
        if (Array.isArray(arr) && arr.length > 0) {
          console.log('[comixto-browser] __NEXT_DATA__ chapters found at pp.' + directKeys[i] + ' count=' + arr.length);
          return mapItems(arr);
        }
      }
      // Check React Query dehydrated state (common Next.js pattern)
      var dh = pp.dehydratedState;
      if (dh && dh.queries && Array.isArray(dh.queries)) {
        for (var qi = 0; qi < dh.queries.length; qi++) {
          var q = dh.queries[qi];
          var qdata = q && q.state && q.state.data;
          if (qdata) {
            var qitems = (qdata.result && Array.isArray(qdata.result.items) ? qdata.result.items : null)
              || (Array.isArray(qdata.result) ? qdata.result : null)
              || (Array.isArray(qdata.items) ? qdata.items : null);
            if (qitems && qitems.length > 0 && qitems[0] && (qitems[0].hash_id || qitems[0].chapter !== undefined || qitems[0].chapter_number !== undefined)) {
              console.log('[comixto-browser] __NEXT_DATA__ chapters in dehydratedState.queries[' + qi + '] count=' + qitems.length);
              return mapItems(qitems);
            }
          }
        }
      }
      // Deep search: look for arrays whose items have chapter-like fields
      // Recurses into array elements (handles React Query nested structures)
      function findChapters(obj, path, depth) {
        if (depth > 10 || !obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
          if (obj.length > 0) {
            var first = obj[0];
            if (first && typeof first === 'object' && (first.hash_id || first.chapter !== undefined || first.chapter_number !== undefined || first.chapter_title)) {
              console.log('[comixto-browser] __NEXT_DATA__ chapters via deep search at ' + path + ' count=' + obj.length);
              return mapItems(obj);
            }
            // Array items are not chapters — recurse into each element
            for (var ai = 0; ai < Math.min(obj.length, 30); ai++) {
              var ar = findChapters(obj[ai], path + '[' + ai + ']', depth + 1);
              if (ar && ar.length > 0) return ar;
            }
          }
          return null;
        }
        var keys = Object.keys(obj);
        for (var k = 0; k < keys.length; k++) {
          var result = findChapters(obj[keys[k]], path + '.' + keys[k], depth + 1);
          if (result && result.length > 0) return result;
        }
        return null;
      }
      var found = findChapters(pp, 'pageProps', 0);
      if (found) return found;
      console.log('[comixto-browser] __NEXT_DATA__ exhausted no chapters, pageProps keys=' + JSON.stringify(Object.keys(pp).slice(0, 20)));
      return null;
    } catch(e) { console.log('[comixto-browser] __NEXT_DATA__ error ' + String(e)); return null; }
  }

  var __INJECTED_XSRF__ = ''; // replaced by main process before executeJavaScript

  function getXsrf() {
    if (__INJECTED_XSRF__) return __INJECTED_XSRF__;
    var m = document.cookie.match(/(?:^|;)\s*XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function readCookieXsrf() {
    var m = document.cookie.match(/(?:^|;)\s*XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function doFetchPage(page) {
    var xsrf = readCookieXsrf() || getXsrf();
    var hdrs = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://comix.to/title/' + id };
    if (xsrf) hdrs['X-XSRF-TOKEN'] = xsrf;
    console.log('[comixto-browser] API fetch page=' + page + ' xsrf_present=' + !!xsrf + ' xsrf_len=' + (xsrf ? xsrf.length : 0));
    return fetch('/api/v2/manga/' + id + '/chapters?page=' + page + '&limit=100', {
      credentials: 'include',
      headers: hdrs
    }).then(function(r) {
      return r.text().then(function(text) {
        console.log('[comixto-browser] chapters status=' + r.status + ' body=' + text.slice(0, 300));
        if (!r.ok) return [];
        var d; try { d = JSON.parse(text); } catch(e) { return []; }
        if (d && d.status === 403) { console.log('[comixto-browser] API status 403 - auth required'); return []; }
        var items = Array.isArray(d.result) ? d.result
          : (d.result && Array.isArray(d.result.items)) ? d.result.items
          : Array.isArray(d.items) ? d.items : [];
        if (items.length === 0) return [];
        var mapped = mapItems(items);
        var pagination = d.pagination || (d.result && d.result.pagination);
        var lastPage = pagination ? (pagination.last_page || 1) : 1;
        if (page >= lastPage) return mapped;
        return fetchPage(page + 1).then(function(rest) { return mapped.concat(rest); });
      });
    }).catch(function(e) { console.log('[comixto-browser] fetch error ' + String(e)); return []; });
  }

  function fromDom() {
    var links = Array.from(document.querySelectorAll('a[href*="/chapter"], a[href*="/ch-"]'));
    var seen = {};
    var out = [];
    links.forEach(function(a) {
      var url = a.href || '';
      if (!url.startsWith('http') || seen[url]) return;
      seen[url] = true;
      var row = a.closest('li, tr') || a;
      var text = (row.textContent || '').trim();
      var mn = text.match(/Chapter[\s.]*(\d+(?:\.\d+)?)/) || text.match(/(\d+(?:\.\d+)?)/);
      out.push({ url: url, hash_id: '', title: text.slice(0, 80), number: mn ? mn[1] : '', date: '' });
    });
    return out;
  }

  // 1. Try SSR data first
  var nd = fromNextData();
  if (nd && nd.length > 0) return Promise.resolve(nd);

  console.log('[comixto-browser] page title=' + document.title + ' cookies=' + document.cookie.slice(0, 120));

  // 2. Fetch chapters API using the injected XSRF token
  function fetchPage(page) { return doFetchPage(page); }

  return fetchPage(1).then(function(api) {
    if (api.length > 0) return api;
    // 3. Poll for DOM links (React may render them async)
    return new Promise(function(resolve) {
      var n = 0;
      var t = setInterval(function() {
        var nd2 = fromNextData();
        if (nd2 && nd2.length > 0) { clearInterval(t); resolve(nd2); return; }
        var dom = fromDom();
        if (dom.length > 0 || ++n >= 30) {
          clearInterval(t);
          if (dom.length === 0) {
            console.log('[comixto-browser] DOM poll ended, body snippet=' + (document.body ? document.body.innerText.slice(0, 300).replace(/[\r\n]+/g, '|') : 'NONE'));
          }
          resolve(dom);
        }
      }, 500);
    });
  });
})()
`

// Extracts page image URLs — tries __NEXT_DATA__ JSON scan first, then DOM
const CHAPTER_SCRIPT = `
new Promise(resolve => {
  function fromNextData() {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el) { console.log('[comixto-chapter] no __NEXT_DATA__'); return []; }
    try {
      const s = el.textContent || '{}';
      try {
        const parsed = JSON.parse(s);
        const pp = parsed?.props?.pageProps ?? {};
        console.log('[comixto-chapter] __NEXT_DATA__ pageProps keys:', JSON.stringify(Object.keys(pp).slice(0, 20)));
        // Log first 500 chars of any key that might be chapter data
        for (const k of Object.keys(pp).slice(0, 10)) {
          const v = pp[k];
          if (v && typeof v === 'object') console.log('[comixto-chapter] pageProps.' + k + ':', JSON.stringify(v).slice(0, 200));
        }
      } catch(e) { console.log('[comixto-chapter] parse error:', String(e)); }
      const m = s.match(/https?:\\/\\/[^"\\s]+\\.(?:jpg|jpeg|png|webp|gif)[^"\\s]*/gi);
      if (!m) { console.log('[comixto-chapter] no image URLs in __NEXT_DATA__'); return []; }
      return [...new Set(m)].filter(u => !/favicon|logo|\\/icon/.test(u));
    } catch { return []; }
  }

  function getUrl(img) {
    return img.getAttribute('data-src') || img.getAttribute('data-lazy-src') ||
           img.getAttribute('data-original') || img.getAttribute('data-url') ||
           img.getAttribute('src') || '';
  }

  function fromDom() {
    const sels = [
      '[class*="reader"] img', '[class*="chapter"] img', '[class*="page"] img',
      '[class*="reading"] img', '[class*="comic"] img', 'main img',
    ];
    for (const sel of sels) {
      const urls = [...document.querySelectorAll(sel)].map(getUrl)
        .filter(u => /^https?:\\/\\/.+\\.(jpg|jpeg|png|webp|gif)/i.test(u));
      if (urls.length > 0) return urls;
    }
    return [...document.querySelectorAll('img')].map(getUrl)
      .filter(u => /^https?:\\/\\/.+\\.(jpg|jpeg|png|webp|gif)/i.test(u));
  }

  function extract() {
    const nd = fromNextData();
    if (nd.length > 0) { resolve(nd); return true; }
    const dom = fromDom();
    if (dom.length > 0) { resolve(dom); return true; }
    return false;
  }

  if (!extract()) {
    let n = 0;
    const t = setInterval(() => {
      if (extract() || ++n >= 30) { clearInterval(t); if (n >= 30) resolve([]); }
    }, 500);
  }
})
`
/* eslint-enable no-useless-escape */

function toIsoDate(raw: number | string | undefined | null): string | undefined {
  if (raw == null) return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!isNaN(n) && n > 0) return new Date(n * 1000).toISOString().slice(0, 10)
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
  return undefined
}

function cleanTitle(raw: string | undefined | null): string {
  if (!raw) return ''
  const s = raw.trim()
  // Hash IDs like "1r0n", "p704", "W2n9", "aB3x" are short alphanumeric without spaces — not real titles
  if (/^[a-zA-Z0-9]{2,12}$/.test(s)) return ''
  return s
}

function dedupChapters(chapters: ChapterEntry[]): ChapterEntry[] {
  chapters.sort((a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0))
  const seen = new Map<string, ChapterEntry>()
  for (const c of chapters) {
    const k = c.number || c.id
    // Prefer entries with more data (title/date) over sparse ones
    if (!seen.has(k) || (!seen.get(k)!.title && c.title) || (!seen.get(k)!.date && c.date)) {
      seen.set(k, c)
    }
  }
  return Array.from(seen.values())
}

function deriveContentRating(detail: {
  is_adult?: boolean
  is_mature?: boolean
  content_rating?: string
  age_rating?: string
  type?: string
  genres?: string[]
}) {
  const r = (detail.content_rating ?? detail.age_rating ?? '').toLowerCase()
  if (detail.is_adult || /adult|hentai|18\+|xxx|x-rated/i.test(r)) return 'adult' as const
  const genres = (detail.genres ?? []).map((g) => g.toLowerCase())
  if (genres.some((g) => /hentai|adult|18\+|xxx/.test(g))) return 'adult' as const
  if (detail.is_mature || /mature/i.test(r)) return 'mature' as const
  if (genres.some((g) => /ecchi|smut|mature|borderline|nudity/.test(g))) return 'mature' as const
  if (genres.some((g) => /violence|gore|horror|psychological/.test(g))) return 'teen' as const
  return 'all-ages' as const
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export function createComixToProvider(fetcher: Fetcher): SourceProvider {
  async function get<T>(path: string): Promise<T> {
    const resp = await fetcher(`${BASE_URL}${path}`, { headers: HEADERS })
    if (!resp.ok) throw new Error(`Comix.to API ${resp.status}: ${path}`)
    return resp.json() as Promise<T>
  }

  return {
    id: 'comixto',

    async browse(page = 1, sort = 'latest'): Promise<SeriesResult[]> {
      const apiSort =
        sort === 'rating'
          ? 'top_rating'
          : sort === 'popular'
            ? 'viewed'
            : sort === 'new'
              ? 'new'
              : 'latest'
      const data = await get<unknown>(`/api/v2/manga?q=&limit=20&sort=${apiSort}&page=${page}`)
      const items = extractItems(data)
      return items
        .map((m) => {
          const updatedAt = toIsoDate(m.chapter_updated_at ?? m.updated_at)
          return {
            id: m.hash_id ?? m.id ?? '',
            title: m.title,
            coverUrl: posterUrl(m.poster),
            latestChapter:
              (m.last_chapter ?? m.latest_chapter ?? m.chapter) != null
                ? `Ch. ${m.last_chapter ?? m.latest_chapter ?? m.chapter}`
                : undefined,
            rating:
              (m.rating ?? m.score) != null ? parseFloat(String(m.rating ?? m.score)) : undefined,
            updatedAt
          }
        })
        .filter((m) => m.id)
    },

    async search(query: string): Promise<SeriesResult[]> {
      const data = await get<unknown>(
        `/api/v2/manga?q=${encodeURIComponent(query)}&limit=100&sort=latest`
      )
      const items = extractItems(data)
      return items
        .map((m) => ({
          id: m.hash_id ?? m.id ?? '',
          title: m.title,
          coverUrl: posterUrl(m.poster)
        }))
        .filter((m) => m.id)
    },

    async getSeries(id: string): Promise<SeriesDetail> {
      interface DetailResult {
        result?: {
          title?: string
          description?: string
          genres?: string[]
          poster?: unknown
          is_adult?: boolean
          is_mature?: boolean
          content_rating?: string
          age_rating?: string
          type?: string
        }
      }
      interface ChapterItem {
        chapter_id?: string
        chapter_number?: string
        chapter_title?: string
        upload_date?: string
      }

      const [detailRaw, chaptersRaw] = await Promise.all([
        get<DetailResult>(`/api/v2/manga/${id}`),
        get<{ result?: ChapterItem[] }>(`/api/v2/manga/${id}/chapter-indexes`)
      ])
      const detail = detailRaw.result ?? {}
      const chapterItems = Array.isArray(chaptersRaw.result) ? chaptersRaw.result : []
      const chapters: ChapterEntry[] = chapterItems.map((c) => ({
        id: c.chapter_id ?? '',
        number: c.chapter_number ?? '',
        title: c.chapter_title ?? '',
        date: c.upload_date ?? ''
      }))
      return {
        id,
        title: detail.title ?? '',
        coverUrl: posterUrl(detail.poster),
        description: detail.description ?? '',
        genres: detail.genres ?? [],
        chapters,
        contentRating: deriveContentRating(detail)
      }
    },

    async getChapterPages(chapterId: string): Promise<PageEntry[]> {
      interface ChapterResult {
        result?: { images?: Array<{ url: string }> }
      }
      const data = await get<ChapterResult>(`/api/v2/chapters/${chapterId}`)
      return (data?.result?.images ?? []).map((img) => ({ url: img.url }))
    },

    async fetchPageBuffer(url: string): Promise<Buffer> {
      const resp = await fetcher(url, { headers: { ...HEADERS, Referer: 'https://comix.to/' } })
      if (!resp.ok) throw new Error(`Comix.to image fetch failed: ${resp.status}`)
      return Buffer.from(await resp.arrayBuffer())
    }
  }
}

export const comixtoProvider: SourceProvider = {
  id: 'comixto',

  async browse(page = 1, sort = 'latest'): Promise<SeriesResult[]> {
    // Map our sort keys to Comix.to API sort values
    const apiSort =
      sort === 'rating'
        ? 'top_rating'
        : sort === 'popular'
          ? 'viewed'
          : sort === 'new'
            ? 'new'
            : 'latest'
    const data = await directGet<unknown>(`/api/v2/manga?q=&limit=20&sort=${apiSort}&page=${page}`)
    const items = extractItems(data)
    if (items.length > 0)
      console.log('[comixto] browse item[0] keys:', JSON.stringify(Object.keys(items[0])))
    return items
      .map((m) => {
        const latestNum = m.last_chapter ?? m.latest_chapter ?? m.chapter
        const rating = m.rating ?? m.score
        const updatedAt = toIsoDate(m.chapter_updated_at ?? m.updated_at)
        return {
          id: m.hash_id ?? m.id ?? '',
          title: m.title,
          coverUrl: posterUrl(m.poster),
          latestChapter: latestNum != null ? `Ch. ${latestNum}` : undefined,
          rating: rating != null ? parseFloat(String(rating)) : undefined,
          updatedAt
        }
      })
      .filter((m) => m.id)
  },

  async search(query: string): Promise<SeriesResult[]> {
    const data = await directGet<unknown>(
      `/api/v2/manga?keyword=${encodeURIComponent(query)}&limit=100&sort=latest`
    )
    const d = data as { items?: MangaItem[]; pagination?: unknown }
    const items = Array.isArray(d.items) ? d.items : extractItems(data)
    return items
      .map((m) => ({ id: m.hash_id ?? m.id ?? '', title: m.title, coverUrl: posterUrl(m.poster) }))
      .filter((m) => m.id)
  },

  async getSeries(id: string): Promise<SeriesDetail> {
    interface DetailResult {
      result?: {
        title?: string
        description?: string
        genres?: string[]
        poster?: unknown
        slug?: string
        term_ids?: unknown[]
        type?: string
        is_adult?: boolean
        is_mature?: boolean
        age_rating?: string
        content_rating?: string
        status?: string
      }
    }
    interface ChapterItem {
      hash_id?: string
      id?: string
      chapter?: string | number
      title?: string
      created_at?: string
      date?: string
    }

    const detailRaw = await directGet<DetailResult>(`/api/v2/manga/${id}`).catch(
      () => ({ result: {} }) as DetailResult
    )
    const detailData = detailRaw
    const detail = detailData.result ?? {}
    console.log(
      '[comixto] detail fields:',
      JSON.stringify(
        Object.fromEntries(
          Object.entries(detail).filter(([k]) => !['poster', 'genres'].includes(k))
        )
      )
    )

    // Chapters require auth. Try ses.fetch first (fast), then CDP intercept as fallback.
    // CDP navigates the hidden window to the manga page and captures the page's own
    // authenticated API call — so auth cookies/CSRF are all handled by the browser itself.
    let chapters: ChapterEntry[]
    let loginRequired = false
    try {
      const raw = await sessionGet<unknown>(`/api/v2/manga/${id}/chapters`)
      const rd = raw as { result?: unknown; items?: unknown; status?: number }
      let items: ChapterItem[] = []
      if (Array.isArray(rd.result) && rd.result.length > 0) items = rd.result as ChapterItem[]
      else if (Array.isArray(rd.items) && rd.items.length > 0) items = rd.items as ChapterItem[]

      if (items.length === 0) {
        // ses.fetch lacks XSRF context even with the header fix — run the fetch inside
        // the real browser window so credentials + XSRF cookie are native to the page.
        let authed = false
        try {
          // Auth check: account/info works without XSRF, so it reliably detects login state
          const acctResp = await comixBrowser.fetch(`${BASE_URL}/api/v2/account/info`)
          const acctText = await acctResp.text()
          console.log(
            '[comixto] account/info http=' + acctResp.status + ' body=' + acctText.slice(0, 600)
          )
          let acctData: { status?: number } = {}
          try {
            acctData = JSON.parse(acctText)
          } catch {
            acctData = {}
          }
          if (acctData.status !== 200) {
            console.log(
              '[comixto] not logged in (account/info status=' +
                acctData.status +
                '), showing login prompt'
            )
            loginRequired = true
          } else {
            authed = true
          }
        } catch (e) {
          console.log('[comixto] account/info check failed:', String(e))
          loginRequired = true
        }

        if (authed) {
          console.log('[comixto] auth verified via account/info, proceeding to load chapters')
          // 1. Try CDP capture: let the page's own JS make the chapters call natively
          console.log('[comixto] trying CDP capture (native page request)')
          interface ChapterItem2 {
            hash_id?: string
            id?: string
            chapter_id?: number
            chapter?: string | number
            number?: number
            title?: string
            name?: string
            created_at?: string | number
          }
          const detailSlug = (detail as { slug?: string }).slug
          const mangaSlug = detailSlug ? `${id}-${detailSlug}` : id
          const captured = await comixBrowser.navigateAndCaptureChapters(mangaSlug, 60_000)
          if (captured) {
            const cd = captured as { result?: unknown; items?: unknown; status?: number }
            let capturedItems: ChapterItem2[] = []
            if (cd.result && typeof cd.result === 'object') {
              const r = cd.result as { items?: unknown[] }
              if (Array.isArray(r.items) && r.items.length > 0)
                capturedItems = r.items as ChapterItem2[]
            }
            if (
              !capturedItems.length &&
              Array.isArray(cd.result) &&
              (cd.result as unknown[]).length > 0
            )
              capturedItems = cd.result as ChapterItem2[]
            if (
              !capturedItems.length &&
              Array.isArray(cd.items) &&
              (cd.items as unknown[]).length > 0
            )
              capturedItems = cd.items as ChapterItem2[]
            if (capturedItems.length > 0) {
              console.log('[comixto] CDP captured', capturedItems.length, 'chapters')
              chapters = capturedItems.map((c) => {
                const num = c.number ?? (typeof c.chapter === 'number' ? c.chapter : undefined)
                const chapId = c.chapter_id ?? c.id ?? c.hash_id ?? ''
                return {
                  id: `${BASE_URL}/title/${mangaSlug}/${chapId}-chapter-${num ?? ''}`,
                  number: String(num ?? c.chapter ?? ''),
                  title: cleanTitle(c.title),
                  date:
                    typeof c.created_at === 'number'
                      ? new Date(c.created_at * 1000).toISOString().slice(0, 10)
                      : String(c.created_at ?? '').slice(0, 10)
                }
              })
              chapters = dedupChapters(chapters)
              return {
                id,
                title: detail.title ?? '',
                coverUrl: posterUrl(detail.poster),
                description: detail.description ?? '',
                genres: detail.genres ?? [],
                chapters,
                contentRating: deriveContentRating(detail)
              }
            }
          }
          // 2. Fall back to in-browser XSRF fetch + DOM scraping
          console.log('[comixto] CDP found nothing, falling back to in-browser scrape')
          try {
            const detailSlug2 = (detail as { slug?: string }).slug
            chapters = await scrapeChapters(id, detailSlug2)
          } catch (e) {
            console.log('[comixto] scrapeChapters threw:', String(e))
            chapters = []
          }
          console.log('[comixto] scrapeChapters returned', chapters.length, 'chapters')
          chapters = dedupChapters(chapters)
          return {
            id,
            title: detail.title ?? '',
            coverUrl: posterUrl(detail.poster),
            description: detail.description ?? '',
            genres: detail.genres ?? [],
            chapters,
            contentRating: deriveContentRating(detail)
          }
        }
      }

      const sessionSlug = (detail as { slug?: string }).slug
      const sessionMangaSlug = sessionSlug ? `${id}-${sessionSlug}` : id
      chapters = items.map((c) => {
        const raw = c as unknown as { chapter_id?: number; number?: number }
        const chapId = raw.chapter_id ?? c.hash_id ?? c.id ?? ''
        const num = raw.number ?? c.chapter ?? ''
        return {
          id: `${BASE_URL}/title/${sessionMangaSlug}/${chapId}-chapter-${num}`,
          number: String(num),
          title: c.title ?? '',
          date:
            typeof c.created_at === 'number'
              ? new Date(c.created_at * 1000).toISOString().slice(0, 10)
              : String(c.created_at ?? c.date ?? '').slice(0, 10)
        }
      })
    } catch (e) {
      console.log('[comixto] getSeries outer catch:', String(e))
      chapters = []
    }

    chapters = dedupChapters(chapters)

    return {
      id,
      title: detail.title ?? '',
      coverUrl: posterUrl(detail.poster),
      description: detail.description ?? '',
      genres: detail.genres ?? [],
      chapters,
      contentRating: deriveContentRating(detail),
      loginRequired: loginRequired && chapters.length === 0
    }
  },

  async getChapterPages(chapterId: string): Promise<PageEntry[]> {
    const url = chapterId.startsWith('http') ? chapterId : `${BASE_URL}/chapter/${chapterId}`
    console.log('[comixto] opening chapter url:', url)

    // Diagnostic: check HTTP status of chapter URL before navigating
    try {
      const probe = await comixBrowser.fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/html' }
      })
      const html = await probe.text()
      console.log('[comixto] chapter url status:', probe.status, 'body len:', html.length)
      // Try to extract image URLs from Next.js RSC flight data inline scripts
      // Next.js 13+ uses: (self.__next_f=self.__next_f||[]).push([1,"payload"])
      // Scan entire HTML for CDN image URLs (covers RSC payload, inline scripts, etc.)
      const allHtmlUrls = [
        ...html.matchAll(/https?:\/\/[^"'\s\\<>]+\.(?:webp|jpg|jpeg|png|gif)[^"'\s\\<>]*/gi)
      ].map((m) => m[0])
      const htmlImageUrls = [...new Set(allHtmlUrls)].filter(
        (u) => !/(favicon|logo|icon|poster|static\.comix|gravatar|_next|\.css|\.js)/i.test(u)
      )
      if (htmlImageUrls.length > 0) {
        console.log(
          '[comixto] chapter HTML scan images:',
          htmlImageUrls.length,
          'first:',
          htmlImageUrls[0]
        )
        return htmlImageUrls.map((u) => ({ url: u }))
      }
      // Also check any inline script JSON for image arrays
      const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]{0,3000}?)<\/script>/gi)]
      for (const m of scriptMatches) {
        const urls = m[1].match(/https?:\/\/[^"'\s]+\.(?:webp|jpg|jpeg|png|gif)[^"'\s]*/gi)
        if (urls && urls.length >= 2) {
          const unique = [...new Set(urls)].filter(
            (u) => !/favicon|logo|icon|poster|static\.comix/i.test(u)
          )
          if (unique.length >= 2) {
            console.log(
              '[comixto] chapter inline script images:',
              unique.length,
              'first:',
              unique[0]
            )
            return unique.map((u) => ({ url: u }))
          }
        }
      }
      console.log('[comixto] chapter HTML OK, proceeding to CDP capture')
    } catch (e) {
      console.log('[comixto] chapter url probe failed:', String(e))
    }

    // Strategy 1: CDP-capture CDN image URLs as they load in the hidden browser
    try {
      const body = await comixBrowser.navigateAndCaptureChapterPages(url, 90_000)
      console.log('[comixto] chapter CDP body:', body.slice(0, 300))
      interface ChapterData {
        result?: {
          pages?: Array<{ url?: string; image?: string; src?: string }>
          images?: string[]
          chapter_images?: string[]
          data?: Array<{ url?: string; image?: string; src?: string }>
        }
        pages?: Array<{ url?: string; image?: string; src?: string }>
        data?: Array<{ url?: string; image?: string; src?: string }>
        images?: string[]
      }
      try {
        const data = JSON.parse(body) as ChapterData & { images?: string[] }
        // CDN image URL list captured directly from network events
        if (Array.isArray(data?.images) && data.images.length > 0) {
          console.log('[comixto] CDP found', data.images.length, 'chapter pages (CDN images)')
          return data.images.map((u: string) => ({ url: u }))
        }
        const pageArr = data?.result?.pages ?? data?.result?.data ?? data?.pages ?? data?.data ?? []
        const structured = pageArr
          .map(
            (p: { url?: string; image?: string; src?: string }) => p.url ?? p.image ?? p.src ?? ''
          )
          .filter((u: string) => u.startsWith('http'))
        if (structured.length > 0) {
          console.log('[comixto] CDP found', structured.length, 'chapter pages (structured)')
          return structured.map((u: string) => ({ url: u }))
        }
        const imageArr = data?.result?.images ?? data?.result?.chapter_images ?? data?.images ?? []
        if (imageArr.length > 0) {
          console.log('[comixto] CDP found', imageArr.length, 'chapter pages (image array)')
          return imageArr.map((u: string) => ({ url: u }))
        }
      } catch {
        /* fall through to regex extraction */
      }

      // Regex extract image URLs directly from the raw body
      const matches = body.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp|gif)[^"'\s]*/gi)
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)]
        console.log('[comixto] CDP found', unique.length, 'chapter pages (regex)')
        return unique.map((u) => ({ url: u }))
      }
    } catch (e) {
      console.log('[comixto] chapter CDP failed:', String(e))
    }

    // Strategy 2: run JS in the page to extract images from __NEXT_DATA__ / DOM
    const urls = await comixBrowser.navigateAndRun<string[]>(url, CHAPTER_SCRIPT)
    if (urls.length === 0) throw new Error('No pages found for this chapter (comix.to)')
    return urls.map((u) => ({ url: u }))
  },

  async fetchPageBuffer(url: string): Promise<Buffer> {
    const resp = await comixBrowser.fetch(url, {
      headers: { ...HEADERS, Referer: 'https://comix.to/' }
    })
    if (!resp.ok) throw new Error(`Comix.to image fetch failed: ${resp.status} for ${url}`)
    return Buffer.from(await resp.arrayBuffer())
  }
}

async function scrapeChapters(id: string, slug?: string): Promise<ChapterEntry[]> {
  const titlePath = slug ? `${id}-${slug}` : id
  // First try: fetch the manga page HTML directly — no CSRF needed, SSR data may be embedded
  try {
    const pageResp = await comixBrowser.fetch(`${BASE_URL}/title/${titlePath}`)
    const html = await pageResp.text()
    const hasNextData = html.includes('__NEXT_DATA__')
    const hasChapterLinks = html.includes('/chapter/')
    console.log(
      `[comixto] HTML fetch: ${html.length} chars, __NEXT_DATA__=${hasNextData}, /chapter/=${hasChapterLinks}`
    )
    if (!hasNextData)
      console.log(
        '[comixto] HTML no __NEXT_DATA__, page start:',
        html.slice(0, 300).replace(/\s+/g, ' ')
      )

    if (hasNextData) {
      const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (ndMatch) {
        const data = JSON.parse(ndMatch[1]) as { props?: { pageProps?: Record<string, unknown> } }
        const pp = data?.props?.pageProps ?? {}
        console.log(
          '[comixto] __NEXT_DATA__ pageProps keys:',
          JSON.stringify(Object.keys(pp).slice(0, 20))
        )

        function isChapterItem(item: unknown): boolean {
          if (!item || typeof item !== 'object') return false
          const c = item as Record<string, unknown>
          return (
            c['hash_id'] !== undefined ||
            c['chapter'] !== undefined ||
            c['chapter_number'] !== undefined
          )
        }

        function mapChapters(arr: Array<Record<string, unknown>>) {
          return arr.map((c, i) => ({
            id: `${BASE_URL}/chapter/${c['hash_id'] ?? c['id'] ?? c['chapter_id'] ?? ''}`,
            number: String(c['chapter'] ?? c['chapter_number'] ?? c['number'] ?? i + 1),
            title: cleanTitle(String(c['title'] ?? '')),
            date:
              typeof c['created_at'] === 'number'
                ? new Date((c['created_at'] as number) * 1000).toISOString().slice(0, 10)
                : String(c['created_at'] ?? c['date'] ?? '').slice(0, 10)
          }))
        }

        function findChaptersIn(
          obj: unknown,
          path: string,
          depth: number
        ): Array<Record<string, unknown>> | null {
          if (depth > 10 || !obj || typeof obj !== 'object') return null
          if (Array.isArray(obj)) {
            if (obj.length > 0 && isChapterItem(obj[0])) {
              console.log(`[comixto] HTML __NEXT_DATA__ chapters at ${path} count=${obj.length}`)
              return obj as Array<Record<string, unknown>>
            }
            for (let ai = 0; ai < Math.min(obj.length, 30); ai++) {
              const r = findChaptersIn(obj[ai], `${path}[${ai}]`, depth + 1)
              if (r && r.length > 0) return r
            }
            return null
          }
          const o = obj as Record<string, unknown>
          if (o['dehydratedState']) {
            type DQItem = {
              state?: { data?: { result?: { items?: unknown[] }; items?: unknown[] } }
            }
            const dh = o['dehydratedState'] as { queries?: DQItem[] }
            if (Array.isArray(dh.queries)) {
              for (const q of dh.queries) {
                const qd = q?.state?.data
                const qitems =
                  (qd?.result && Array.isArray(qd.result.items) ? qd.result.items : null) ??
                  (qd?.items && Array.isArray(qd.items) ? qd.items : null)
                if (qitems && qitems.length > 0 && isChapterItem(qitems[0])) {
                  console.log(
                    `[comixto] HTML __NEXT_DATA__ chapters in dehydratedState count=${qitems.length}`
                  )
                  return qitems as Array<Record<string, unknown>>
                }
              }
            }
          }
          for (const key of Object.keys(o)) {
            const r = findChaptersIn(o[key], `${path}.${key}`, depth + 1)
            if (r && r.length > 0) return r
          }
          return null
        }

        const found = findChaptersIn(pp, 'pageProps', 0)
        if (found && found.length > 0) return mapChapters(found)
        console.log('[comixto] HTML __NEXT_DATA__ no chapters found')
      }
    }
    if (hasChapterLinks) {
      // Match new URL format: /title/{manga-slug}/{chapter_id}-chapter-{number}
      const links = [
        ...html.matchAll(/href="(https?:\/\/comix\.to\/title\/[^"]+\/(\d+)-chapter-([^"]+))"/g)
      ]
      if (links.length > 0) {
        console.log(`[comixto] found ${links.length} chapter links in HTML`)
        const seen = new Set<string>()
        return links
          .filter((m) => {
            const key = m[2]
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .map((m, i) => ({ id: m[1], number: m[3] || String(i + 1), title: '', date: '' }))
      }
    }
  } catch (e) {
    console.log('[comixto] HTML fetch error:', String(e))
  }

  // Second try: run JS in the hidden window (in-browser fetch with injected XSRF)
  type ScrapedChapter = {
    url: string
    hash_id: string
    title: string
    number: string
    date: string
  }
  const scraped = await comixBrowser.navigateAndRunWithXsrf<ScrapedChapter[]>(
    `${BASE_URL}/title/${titlePath}`,
    SERIES_SCRIPT,
    "  var __INJECTED_XSRF__ = ''; // replaced by main process before executeJavaScript"
  )
  console.log('[comixto] scrapeChapters in-browser result:', scraped.length)
  return scraped.map((c, i) => ({
    id:
      c.hash_id && (c.number || i)
        ? `${BASE_URL}/title/${titlePath}/${c.hash_id}-chapter-${c.number || String(i + 1)}`
        : c.url || `${BASE_URL}/title/${titlePath}`,
    number: c.number || String(i + 1),
    title: cleanTitle(c.title),
    date: c.date || ''
  }))
}
