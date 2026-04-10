import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        DB: {
          prepare: () => ({
            bind: () => ({
              first: async () => null,
              all: async () => ({ results: [] }),
              run: async () => ({ success: true }),
            }),
          }),
        },
        LITELLM_URL: 'http://localhost:4000',
        LITELLM_MASTER_KEY: 'test-master-key',
        ADMIN_API_KEY: 'test-admin-key',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})