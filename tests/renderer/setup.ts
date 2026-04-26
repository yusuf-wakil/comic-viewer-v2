import '@testing-library/jest-dom'

Object.defineProperty(window, 'ipc', {
  value: { invoke: vi.fn().mockResolvedValue({ ok: true, data: [] }) },
  writable: true,
  configurable: true
})
