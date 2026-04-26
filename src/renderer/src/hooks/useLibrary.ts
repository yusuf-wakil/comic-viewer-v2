import { useCallback } from 'react'
import { useLibraryStore } from '../store/library'
import { useIpc } from './useIpc'

export function useLibrary() {
  const { invoke } = useIpc()
  const { setComics, setLoading, setError } = useLibraryStore()

  const loadLibrary = useCallback(async () => {
    setLoading(true)
    try {
      const data = await invoke('library:getAll', undefined as never)
      setComics(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [invoke, setComics, setLoading, setError])

  const scanFolder = useCallback(
    async (path: string) => {
      setLoading(true)
      try {
        const data = await invoke('library:scan', { path })
        setComics(data)
      } catch (e) {
        setError(String(e))
        throw e
      } finally {
        setLoading(false)
      }
    },
    [invoke, setComics, setLoading, setError]
  )

  return { loadLibrary, scanFolder }
}
