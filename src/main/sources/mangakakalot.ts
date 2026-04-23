import type { SourceProvider } from './index'
import type { SeriesResult, SeriesDetail, ChapterEntry, PageEntry } from '@shared/types/source'
import { mangakakalotBrowser } from './mangakakalot-browser'

const BASE_URL = 'https://ww6.mangakakalot.tv'

// Poll up to 30s for content to appear (parklogic challenge may inject HTML asynchronously)
function waitFor(selector: string, extractor: string): string {
  return `
new Promise(resolve => {
  function attempt() {
    ${extractor}
  }
  if (!attempt()) {
    let n = 0;
    const t = setInterval(() => {
      if (attempt() || ++n >= 60) { clearInterval(t); if (n >= 60) resolve(null); }
    }, 500);
  }
})`.trim()
}

const BROWSE_SCRIPT = `
new Promise(resolve => {
  function attempt() {
    const items = [
      ...document.querySelectorAll('.truyen-list .list-truyen-item-wrap'),
      ...document.querySelectorAll('.panel_story_list .story_item'),
    ];
    if (items.length === 0) return false;
    const results = [];
    items.forEach(el => {
      const a = el.querySelector('a[href*="/manga/"]');
      const img = el.querySelector('img');
      const titleEl = el.querySelector('h3 a, .story_name a, h3');
      if (!a) return;
      const href = a.href || '';
      const idMatch = href.match(/\\/manga\\/([^/]+)/);
      if (!idMatch) return;
      results.push({
        id: idMatch[1],
        title: titleEl ? titleEl.textContent.trim() : '',
        coverUrl: img ? (img.getAttribute('data-src') || img.src || '') : ''
      });
    });
    if (results.length > 0) { resolve(results); return true; }
    return false;
  }
  if (!attempt()) {
    let n = 0;
    const t = setInterval(() => {
      if (attempt() || ++n >= 60) { clearInterval(t); if (n >= 60) resolve([]); }
    }, 500);
  }
})
`

const SEARCH_SCRIPT = `
new Promise(resolve => {
  function attempt() {
    const items = [
      ...document.querySelectorAll('.panel_story_list .story_item'),
      ...document.querySelectorAll('.truyen-list .list-truyen-item-wrap'),
    ];
    if (items.length === 0) return false;
    const results = [];
    items.forEach(el => {
      const a = el.querySelector('a[href*="/manga/"]');
      const img = el.querySelector('img');
      const titleEl = el.querySelector('h3 a, .story_name a, h3');
      if (!a) return;
      const href = a.href || '';
      const idMatch = href.match(/\\/manga\\/([^/]+)/);
      if (!idMatch) return;
      results.push({
        id: idMatch[1],
        title: titleEl ? titleEl.textContent.trim() : '',
        coverUrl: img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : ''
      });
    });
    if (results.length > 0) { resolve(results); return true; }
    return false;
  }
  if (!attempt()) {
    let n = 0;
    const t = setInterval(() => {
      if (attempt() || ++n >= 60) { clearInterval(t); if (n >= 60) resolve([]); }
    }, 500);
  }
})
`

const SERIES_SCRIPT = `
new Promise(resolve => {
  function attempt() {
    const chapterRows = document.querySelectorAll('.chapter-list .row');
    if (chapterRows.length === 0) return false;

    const chapters = [];
    chapterRows.forEach(row => {
      const a = row.querySelector('span a');
      if (!a) return;
      const href = a.href || '';
      const parts = href.split('/');
      const chapterId = parts[parts.length - 1];
      const mangaId = parts[parts.length - 2];
      const nameText = a.textContent.trim();
      const numMatch = nameText.match(/[Cc]hapter[\\s.]*(\\d+(?:\\.\\d+)?)/);
      const dateEl = row.querySelector('span:nth-child(3)');
      chapters.push({
        id: href,
        number: numMatch ? numMatch[1] : '',
        title: nameText,
        date: dateEl ? dateEl.textContent.trim() : ''
      });
    });

    const titleEl = document.querySelector('.manga-info-text h1, .manga-info-top h1');
    const coverEl = document.querySelector('.manga-info-pic img, .manga-info-top img');
    const descEl = document.querySelector('#noidungm, .manga-info-text .story-detail-item[itemprop="description"]');
    const genreEls = document.querySelectorAll('.manga-info-text .manga-info-text li:nth-child(7) a');

    resolve({
      title: titleEl ? titleEl.textContent.trim() : '',
      coverUrl: coverEl ? (coverEl.getAttribute('src') || '') : '',
      description: descEl ? descEl.textContent.trim().slice(0, 1000) : '',
      genres: [...genreEls].map(a => a.textContent.trim()).filter(Boolean),
      chapters
    });
    return true;
  }
  if (!attempt()) {
    let n = 0;
    const t = setInterval(() => {
      if (attempt() || ++n >= 60) {
        clearInterval(t);
        if (n >= 60) resolve({ title: '', coverUrl: '', description: '', genres: [], chapters: [] });
      }
    }, 500);
  }
})
`

const CHAPTER_SCRIPT = `
new Promise(resolve => {
  function attempt() {
    const imgs = [
      ...document.querySelectorAll('.vung-doc img'),
      ...document.querySelectorAll('.container-chapter-reader img'),
      ...document.querySelectorAll('[class*="reader"] img'),
    ];
    const urls = imgs
      .map(img => img.getAttribute('data-src') || img.getAttribute('src') || '')
      .filter(u => /^https?:\\/\\/.+\\.(jpg|jpeg|png|webp)/i.test(u));
    if (urls.length > 0) { resolve(urls); return true; }
    return false;
  }
  if (!attempt()) {
    let n = 0;
    const t = setInterval(() => {
      if (attempt() || ++n >= 60) { clearInterval(t); if (n >= 60) resolve([]); }
    }, 500);
  }
})
`

type BrowseResult = { id: string; title: string; coverUrl: string }[]
type SeriesData = {
  title: string; coverUrl: string; description: string
  genres: string[]; chapters: { id: string; number: string; title: string; date: string }[]
}

export const mangakakalotProvider: SourceProvider = {
  id: 'mangakakalot',

  async browse(page = 1): Promise<SeriesResult[]> {
    const url = `${BASE_URL}/manga_list?type=latest&category=0&state=all&page=${page}`
    const items = await mangakakalotBrowser.navigateAndRun<BrowseResult>(url, BROWSE_SCRIPT)
    return (items ?? []).map(m => ({ id: m.id, title: m.title, coverUrl: m.coverUrl }))
  },

  async search(query: string): Promise<SeriesResult[]> {
    const url = `${BASE_URL}/search/${encodeURIComponent(query.replace(/\s+/g, '_'))}?page=1`
    const items = await mangakakalotBrowser.navigateAndRun<BrowseResult>(url, SEARCH_SCRIPT)
    return (items ?? []).map(m => ({ id: m.id, title: m.title, coverUrl: m.coverUrl }))
  },

  async getSeries(id: string): Promise<SeriesDetail> {
    const url = `${BASE_URL}/manga/${id}`
    const data = await mangakakalotBrowser.navigateAndRun<SeriesData>(url, SERIES_SCRIPT)

    // Sort chapters ascending by number, deduplicate
    const seen = new Map<string, ChapterEntry>()
    const chapters: ChapterEntry[] = (data.chapters ?? []).map(c => ({
      id: c.id,
      number: c.number,
      title: c.title,
      date: c.date
    }))
    chapters.sort((a, b) => (parseFloat(a.number) || 0) - (parseFloat(b.number) || 0))
    for (const c of chapters) {
      const key = c.number || c.id
      if (!seen.has(key)) seen.set(key, c)
    }

    return {
      id,
      title: data.title,
      coverUrl: data.coverUrl,
      description: data.description,
      genres: data.genres,
      chapters: Array.from(seen.values())
    }
  },

  async getChapterPages(chapterId: string): Promise<PageEntry[]> {
    // chapterId is the full chapter URL
    const url = chapterId.startsWith('http') ? chapterId : `${BASE_URL}/chapter/${chapterId}`
    const urls = await mangakakalotBrowser.navigateAndRun<string[]>(url, CHAPTER_SCRIPT)
    return (urls ?? []).map(u => ({ url: u }))
  },

  async fetchPageBuffer(url: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ses = (await import('electron')).session.fromPartition('persist:mangakakalot') as any
    const resp = await ses.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': BASE_URL
      }
    })
    if (!resp.ok) throw new Error(`Mangakakalot image fetch failed: ${resp.status}`)
    return Buffer.from(await resp.arrayBuffer())
  }
}
