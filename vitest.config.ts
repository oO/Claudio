/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],

  // Path resolution (same as main vite config)
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src-frontend', import.meta.url)),
    },
  },

  test: {
    // Use jsdom for DOM simulation
    environment: 'jsdom',

    // Setup files for global test configuration
    setupFiles: ['./src-frontend/test-setup.ts'],

    // Include only frontend test files from centralized location
    include: ['src-frontend/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Exclude backend and build files
    exclude: [
      'node_modules/**',
      'src-backend/**',
      'dist/**',
      'build/**',
      '.{idea,git,cache,output,temp}/**',
      '{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],

    // Global test configuration
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src-frontend/**/*.{ts,tsx}'],
      exclude: [
        'src-frontend/**/*.test.{ts,tsx}',
        'src-frontend/**/*.spec.{ts,tsx}',
        'src-frontend/test-setup.ts',
        'src-frontend/test-utils/**',
        'src-frontend/**/*.d.ts',
        'src-frontend/deprecated/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },

    // Performance tuning
    testTimeout: 10000,
    hookTimeout: 10000,

    // Better error reporting
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './coverage/test-report.html'
    }
  }
})