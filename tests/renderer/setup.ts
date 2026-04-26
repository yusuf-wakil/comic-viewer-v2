import '@testing-library/jest-dom'
import { vi } from 'vitest'

Object.defineProperty(window, 'ipc', {
  value: { invoke: vi.fn().mockResolvedValue({ ok: true, data: [] }) },
  writable: true,
  configurable: true,
})
