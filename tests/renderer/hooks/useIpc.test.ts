import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIpc } from '../../../src/renderer/src/hooks/useIpc'

const mockInvoke = vi.fn()
vi.stubGlobal('ipc', { invoke: mockInvoke, on: vi.fn(() => () => {}) })

describe('useIpc', () => {
  beforeEach(() => mockInvoke.mockReset())

  it('returns data on success', async () => {
    mockInvoke.mockResolvedValue({ ok: true, data: [{ id: '1', title: 'Batman' }] })
    const { result } = renderHook(() => useIpc())
    let data: unknown
    await act(async () => {
      const res = await result.current.invoke('library:getAll', undefined as never)
      data = res
    })
    expect(data).toEqual([{ id: '1', title: 'Batman' }])
  })

  it('throws on error result', async () => {
    mockInvoke.mockResolvedValue({ ok: false, error: 'DB error' })
    const { result } = renderHook(() => useIpc())
    await expect(
      act(async () => result.current.invoke('library:getAll', undefined as never))
    ).rejects.toThrow('DB error')
  })
})
