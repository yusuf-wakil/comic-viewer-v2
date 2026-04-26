import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/renderer/setup.ts'],
    include: ['tests/renderer/**/*.test.{ts,tsx}']
  },
  resolve: {
    alias: { '@shared': resolve('src/shared') }
  }
})
