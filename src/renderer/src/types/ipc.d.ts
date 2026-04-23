import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc/types'

declare global {
  interface Window {
    ipc: {
      invoke<C extends IpcChannel>(channel: C, req: IpcReq<C>): Promise<IpcRes<C>>
      on<C extends IpcChannel>(channel: C, fn: (payload: IpcRes<C>) => void): () => void
    }
  }
}
