import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc/types'

// Unwrap IpcResult<T> → T
type UnwrapResult<R> = R extends { ok: true; data: infer T } ? T : never

export function useIpc() {
  async function invoke<C extends IpcChannel>(
    channel: C,
    req: IpcReq<C>
  ): Promise<UnwrapResult<IpcRes<C>>> {
    const result = await window.ipc.invoke(channel, req)
    if (!result.ok) throw new Error(result.error)
    return result.data as UnwrapResult<IpcRes<C>>
  }

  return { invoke }
}
