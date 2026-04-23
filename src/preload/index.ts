import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc/types'

const ipc = {
  invoke<C extends IpcChannel>(channel: C, req: IpcReq<C>): Promise<IpcRes<C>> {
    return ipcRenderer.invoke(channel, req) as Promise<IpcRes<C>>
  },
  on<C extends IpcChannel>(channel: C, fn: (payload: IpcRes<C>) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, payload: IpcRes<C>) => fn(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('ipc', ipc)

declare global {
  interface Window {
    ipc: typeof ipc
  }
}
