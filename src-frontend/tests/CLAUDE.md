# Frontend Testing Guidelines for Claudio

## 🚨 CRITICAL: Testing Rules You MUST Follow

### 1. **NEVER MODIFY SOURCE FILES**
- ❌ **DO NOT** add test code to any component or hook files
- ❌ **DO NOT** embed test functions in source files
- ✅ **ONLY** create test files in `src-frontend/tests/` directory
- ✅ **ONLY** import from existing source files, never modify them

### 2. **File Organization & Naming**
```
src-frontend/
└── tests/                              # Centralized test location
    ├── components/
    │   ├── sessions/
    │   │   ├── AssistantMessageFilter.test.tsx
    │   │   ├── SystemFilter.test.tsx
    │   │   └── ToolFilter.test.tsx
    │   ├── agents/
    │   │   └── AgentCard.test.tsx
    │   └── projects/
    │       └── ProjectList.test.tsx
    ├── hooks/
    │   ├── useSessionHandle.test.ts
    │   └── useSessionFileWatcher.test.ts
    ├── lib/
    │   ├── contextParser.test.ts
    │   └── sessionHandleApi.test.ts
    ├── contexts/
    │   └── SettingsContext.test.tsx
    └── CLAUDE.md ✅ (this file)
```

### 3. **Required Test Setup**
Every test file MUST start with:

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderWithProviders, setupTauriMocks, resetTauriMocks } from '@/test-utils'
import { ComponentUnderTest } from '@/components/path/ComponentName' // Absolute import from src

describe('ComponentName', () => {
  beforeEach(() => {
    setupTauriMocks()
  })

  afterEach(() => {
    resetTauriMocks()
  })

  test('does something specific', () => {
    // Test implementation
  })
})
```

### 4. **Testing Infrastructure Already Available**

#### **Test Utilities** (`@/test-utils`)
```typescript
// Pre-configured mocks and helpers
import {
  renderWithProviders,     // React Testing Library with providers
  setupTauriMocks,        // Setup all Tauri IPC mocks
  resetTauriMocks,        // Reset mocks between tests
  mockTauriInvoke,        // Mock Tauri invoke calls
  mockTauriListen,        // Mock Tauri event listeners
  mockLogger              // Mock the centralized logger
} from '@/test-utils'
```

#### **Vitest Configuration** (already setup)
- **jsdom environment** for DOM simulation
- **Tauri mocks** for all IPC calls
- **Global test helpers** available
- **Coverage reporting** configured

#### **Test Scripts** (already available)
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI
npm run test:coverage # Run with coverage report
```

## Component Testing by Area

### **Session Components** (`tests/components/sessions/`)

#### **Message Filters Tests**
Test files: `AssistantMessageFilter.test.tsx`, `SystemFilter.test.tsx`, `ToolFilter.test.tsx`

Test requirements:
- Filter state management (active/inactive)
- Message filtering logic with different content types
- User interaction (clicking filter buttons)
- Integration with session context
- Accessibility (screen reader support)

#### **Session Management Tests**
Test files: `SessionDetail.test.tsx`, `SessionTimeline.test.tsx`

Test requirements:
- Real-time message streaming (mocked events)
- Session state transitions
- Error handling for failed sessions
- Loading states during session operations
- Message deduplication logic

### **Hooks Tests** (`tests/hooks/`)

#### **Session Hooks Tests**
Test files: `useSessionHandle.test.ts`, `useSessionFileWatcher.test.ts`

Test requirements:
- Hook state management
- Tauri IPC integration (mocked)
- Event listener setup/cleanup
- Error handling and retries
- Memory leak prevention

#### **Settings Hooks Tests**
Test requirements:
- Settings state synchronization
- Multi-layer settings precedence
- Cache invalidation logic
- External change detection

### **Library Tests** (`tests/lib/`)

#### **Utility Functions Tests**
Test files: `sessionHandleApi.test.ts`, `settingsApi.test.ts`

Test requirements:
- API call wrappers (mocked Tauri invoke)
- Data transformation functions
- Error handling and parsing
- Response validation

## Test Requirements Checklist

### For EVERY component test:
- [ ] Uses `renderWithProviders` for rendering
- [ ] Mocks ALL Tauri IPC calls with `setupTauriMocks`
- [ ] Tests user interactions with `userEvent`
- [ ] Tests accessibility with screen reader queries
- [ ] Tests loading states and error boundaries
- [ ] Cleans up with `resetTauriMocks` in afterEach
- [ ] Uses `@/lib/logger` mock instead of console

### For EVERY hook test:
- [ ] Uses `renderHook` from React Testing Library
- [ ] Mocks Tauri events and IPC calls
- [ ] Tests hook state changes over time
- [ ] Tests cleanup on unmount
- [ ] Tests error scenarios and recovery

### For EVERY utility test:
- [ ] Tests pure functions with various inputs
- [ ] Tests error handling and edge cases
- [ ] Mocks external dependencies
- [ ] Tests data validation and transformation

## Example Component Test

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderWithProviders, setupTauriMocks, resetTauriMocks } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { AssistantMessageFilter } from '@/components/sessions/AssistantMessageFilter'

describe('AssistantMessageFilter', () => {
  beforeEach(() => {
    setupTauriMocks()
  })

  afterEach(() => {
    resetTauriMocks()
  })

  test('toggles filter state when clicked', async () => {
    const user = userEvent.setup()
    const mockOnToggle = vi.fn()

    renderWithProviders(
      <AssistantMessageFilter
        isActive={false}
        onToggle={mockOnToggle}
        messageCount={5}
      />
    )

    const filterButton = screen.getByRole('button', { name: /assistant messages/i })
    await user.click(filterButton)

    expect(mockOnToggle).toHaveBeenCalledWith(true)
  })

  test('displays correct message count', () => {
    renderWithProviders(
      <AssistantMessageFilter
        isActive={true}
        onToggle={vi.fn()}
        messageCount={12}
      />
    )

    expect(screen.getByText('12')).toBeInTheDocument()
  })

  test('is accessible to screen readers', () => {
    renderWithProviders(
      <AssistantMessageFilter
        isActive={false}
        onToggle={vi.fn()}
        messageCount={3}
      />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAccessibleName()
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
```

## Example Hook Test

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { setupTauriMocks, resetTauriMocks, mockTauriInvoke } from '@/test-utils'
import { useSessionHandle } from '@/hooks/useSessionHandle'

describe('useSessionHandle', () => {
  beforeEach(() => {
    setupTauriMocks()
  })

  afterEach(() => {
    resetTauriMocks()
  })

  test('creates session handle successfully', async () => {
    mockTauriInvoke.mockResolvedValueOnce('session-handle-123')

    const { result } = renderHook(() =>
      useSessionHandle('/test/project', 'standard')
    )

    await waitFor(() => {
      expect(result.current.handleId).toBe('session-handle-123')
    })

    expect(mockTauriInvoke).toHaveBeenCalledWith(
      'create_session_handle',
      {
        projectPath: '/test/project',
        sessionType: 'standard'
      }
    )
  })

  test('handles session creation errors', async () => {
    mockTauriInvoke.mockRejectedValueOnce(new Error('Failed to create'))

    const { result } = renderHook(() =>
      useSessionHandle('/test/project', 'standard')
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to create')
    })

    expect(result.current.handleId).toBeNull()
  })
})
```

## Tauri IPC Mocking Patterns

### **Mock Tauri Commands**
```typescript
beforeEach(() => {
  setupTauriMocks()

  // Custom mock responses for specific tests
  mockTauriInvoke.mockImplementation((cmd, args) => {
    switch (cmd) {
      case 'get_projects':
        return Promise.resolve([
          { id: '1', name: 'Test Project', path: '/test' }
        ])
      case 'create_session_handle':
        return Promise.resolve('session-123')
      default:
        return Promise.resolve({})
    }
  })
})
```

### **Mock Tauri Events**
```typescript
test('handles session message events', async () => {
  const { result } = renderHook(() => useSessionFileWatcher('session-123'))

  // Simulate Tauri event
  const mockEvent = {
    payload: {
      handle_id: 'session-123',
      message_type: 'assistant',
      content: 'Test message',
      uuid: 'msg-123'
    }
  }

  // Trigger the mocked event listener
  const listener = mockTauriListen.mock.calls[0][1]
  await listener(mockEvent)

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(1)
  })
})
```

## Testing Patterns for Claudio Features

### **Real-time Session Streaming**
```typescript
test('updates UI when new messages arrive', async () => {
  renderWithProviders(<SessionDetail sessionId="session-123" />)

  // Simulate streaming message
  const messageEvent = {
    payload: {
      handle_id: 'session-123',
      message_type: 'assistant',
      content: 'Hello world',
      uuid: 'msg-456'
    }
  }

  // Trigger event
  const eventListener = mockTauriListen.mock.calls[0][1]
  await eventListener(messageEvent)

  await waitFor(() => {
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })
})
```

### **Settings Management**
```typescript
test('applies settings changes immediately', async () => {
  mockTauriInvoke
    .mockResolvedValueOnce('settings-handle-789') // create_settings_handle
    .mockResolvedValueOnce(undefined) // update_setting_for_handle

  renderWithProviders(<SettingsPanel projectPath="/test" />)

  const modelSelect = screen.getByRole('combobox', { name: /model/i })
  await userEvent.selectOptions(modelSelect, 'opus')

  expect(mockTauriInvoke).toHaveBeenCalledWith(
    'update_setting_for_handle',
    {
      handleId: 'settings-handle-789',
      key: 'model',
      value: 'opus',
      level: 'project'
    }
  )
})
```

## What NOT to Test
- Don't test Tauri framework functionality
- Don't test third-party component libraries (Radix UI, etc.)
- Don't test CSS styling (use visual regression tools instead)
- Don't test React framework behavior
- Don't test implementation details that users don't see

## Coverage Goals
- **Components**: 80%+ coverage focusing on user interactions
- **Hooks**: 90%+ coverage including error paths
- **Utilities**: 95%+ coverage with edge cases
- **Integration**: Key user workflows end-to-end

## Performance Testing
- Test with large datasets (many messages, agents)
- Test rapid state changes (fast typing, quick clicks)
- Test memory leaks (mount/unmount cycles)
- Test event listener cleanup

## Accessibility Testing
Every component test MUST verify:
- Screen reader compatibility
- Keyboard navigation
- ARIA attributes and roles
- Color contrast (where applicable)
- Focus management

## Final Verification
Before submitting your tests:

1. **Run TypeScript check**: `npm run check` - MUST pass
2. **Run all tests**: `npm run test:run` - ALL tests MUST pass
3. **Check coverage**: `npm run test:coverage` - Meet coverage goals
4. **Visual check**: `npm run test:ui` - Review test results
5. **Integration**: Test with actual Claudio app to verify mocks are realistic

Remember: Your tests should verify user-facing behavior, be maintainable, and provide confidence that the feature works correctly. Focus on testing what users actually experience, not implementation details.