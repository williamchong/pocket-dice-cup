import { defineConfig } from 'vitest/config'

// The engine is plain TypeScript with no Vue or Nuxt imports, so its tests run
// in Node without the Nuxt test environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
