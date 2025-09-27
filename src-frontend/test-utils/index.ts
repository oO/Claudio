import { vi } from 'vitest'

// Mock Tauri invoke function
export const mockTauriInvoke = vi.fn()

// Mock Tauri listen function
export const mockTauriListen = vi.fn()

// Mock Tauri emit function
export const mockTauriEmit = vi.fn()

// Helper to setup common Tauri invoke responses
export const setupTauriMocks = () => {
  mockTauriInvoke.mockImplementation((cmd: string, args?: any) => {
    // Default successful responses for common commands
    switch (cmd) {
      case 'create_session_handle':
        return Promise.resolve('test-session-handle-123')
      case 'create_settings_handle':
        return Promise.resolve('test-settings-handle-456')
      case 'get_projects':
        return Promise.resolve([])
      case 'get_agents':
        return Promise.resolve([])
      default:
        return Promise.resolve({})
    }
  })

  mockTauriListen.mockImplementation(() => {
    // Return a mock unlisten function
    return Promise.resolve(() => {})
  })

  mockTauriEmit.mockImplementation(() => Promise.resolve())
}

// Helper to reset all Tauri mocks
export const resetTauriMocks = () => {
  mockTauriInvoke.mockReset()
  mockTauriListen.mockReset()
  mockTauriEmit.mockReset()
}

// Mock logger for tests
export const mockLogger = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

// React Testing Library custom render function with providers
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  // Add any global providers here if needed in the future
  // const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  //   return <>{children}</>
  // }

  return render(ui, { ...options })
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'