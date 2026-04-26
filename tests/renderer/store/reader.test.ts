import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    clear: () => { store = {} }
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { useReaderStore } from '../../../src/renderer/src/store/reader'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  useReaderStore.setState({
    comicId: null, pageUrls: [], currentPage: 0, scrollMode: false
  })
})

describe('readerStore – scrollMode', () => {
  test('defaults to false', () => {
    expect(useReaderStore.getState().scrollMode).toBe(false)
  })

  test('setScrollMode updates scrollMode', () => {
    act(() => useReaderStore.getState().setScrollMode(true))
    expect(useReaderStore.getState().scrollMode).toBe(true)
  })

  test('setScrollMode persists to localStorage', () => {
    act(() => useReaderStore.getState().setScrollMode(true))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader.scrollMode', 'true')
  })

  test('setScrollMode(false) writes false to localStorage', () => {
    act(() => useReaderStore.getState().setScrollMode(false))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('reader.scrollMode', 'false')
  })
})
