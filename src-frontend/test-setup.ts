import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Tauri API completely
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}))

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  open: vi.fn(),
}))

// Mock Tauri event system for session streaming
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
  unlisten: vi.fn(),
  TauriEvent: {},
}))

// Mock window APIs that Tauri uses
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver for virtualization
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock scrollIntoView for test stability
Element.prototype.scrollIntoView = vi.fn()

// Setup global test environment
global.__APP_VERSION__ = '0.6.3-test'

// Mock logger to prevent actual backend calls during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}))

// Export commonly used test utilities for use in tests
// Note: These need to be imported in individual test files, not exported from setup