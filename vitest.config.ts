import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Workspace packages resolve to SOURCE in tests: no build freshness
      // dependency, hermetic by default (public npm deps only).
      '@dshelm/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@dshelm/dsh': fileURLToPath(new URL('./packages/dsh/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    passWithNoTests: false,
  },
})
