import type { Comic, PageUrl, ReadingProgress } from '../types/comic'
import type {
  SourceId,
  BrowseSort,
  SeriesResult,
  SeriesDetail,
  LatestUpdate
} from '../types/source'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface IpcChannels {
  // Library
  'library:scan': { req: { path: string }; res: IpcResult<Comic[]> }
  'library:getAll': { req: void; res: IpcResult<Comic[]> }
  'library:remove': { req: { comicId: string }; res: IpcResult<void> }
  // Reader
  'reader:open': { req: { comicId: string }; res: IpcResult<PageUrl[]> }
  'reader:progress': { req: { comicId: string; page: number }; res: IpcResult<void> }
  'reader:getProgress': { req: { comicId: string }; res: IpcResult<ReadingProgress | null> }
  // Dialog
  'dialog:openFolder': { req: void; res: IpcResult<string | null> }
  // Settings
  'settings:get': { req: { key: string }; res: IpcResult<string | null> }
  'settings:set': { req: { key: string; value: string }; res: IpcResult<void> }
  // Sources
  'sources:browse': {
    req: { sourceId: SourceId; page: number; sort?: BrowseSort }
    res: IpcResult<SeriesResult[]>
  }
  'sources:getLatestUpdates': { req: { sourceId: SourceId }; res: IpcResult<LatestUpdate[]> }
  'sources:search': { req: { sourceId: SourceId; query: string }; res: IpcResult<SeriesResult[]> }
  'sources:getSeries': {
    req: { sourceId: SourceId; seriesId: string }
    res: IpcResult<SeriesDetail>
  }
  'sources:openChapter': {
    req: { sourceId: SourceId; chapterId: string }
    res: IpcResult<PageUrl[]>
  }
  'sources:comixtoLogin': { req: void; res: IpcResult<{ loggedIn: boolean }> }
}

export type IpcChannel = keyof IpcChannels
export type IpcReq<C extends IpcChannel> = IpcChannels[C]['req']
export type IpcRes<C extends IpcChannel> = IpcChannels[C]['res']
