# Frontend Development Guidelines

## Session Streaming Architecture

**Tauri Event System:**
```typescript
// Listen for streaming messages from backend
useEffect(() => {
  const unlisten = listen<StreamedMessage>("session_message_stream", (event) => {
    const { handle_id, message_type, content, uuid } = event.payload;
    // Handle streamed message in UI
  });
  return () => unlisten.then(f => f());
}, []);
```

**Session Handle Integration:**
- Frontend requests session handles via `create_session_handle()`
- Backend returns handle ID for tracking specific sessions
- UI components subscribe to handle-specific streaming events
- Messages filtered by `handle_id` to ensure correct routing

**File Locations:**
- Session API: `src-frontend/lib/sessionHandleApi.ts`
- React hooks: `src-frontend/hooks/useSessionFileWatcher.ts`
- Components: `src-frontend/components/sessions/SessionHandleView.tsx`

## 🚨 MANDATORY: Use Centralized Logger System

**NEVER use console.log, console.error, console.warn, console.info, or console.debug in frontend code!**

### Required Import
```typescript
import { logger } from '@/lib/logger';
```

### Required Usage
```typescript
// ✅ CORRECT - Use logger methods
logger.log('Info message');
logger.info('Info message');  
logger.warn('Warning message');
logger.error('Error message'); 
logger.debug('Debug message');

// ❌ WRONG - Do NOT use console methods
console.log('message');    // FORBIDDEN
console.error('error');    // FORBIDDEN
console.warn('warning');   // FORBIDDEN
console.info('info');      // FORBIDDEN
console.debug('debug');    // FORBIDDEN
```

### Why This Matters
1. **Unified Logging**: All logs go through Tauri backend for centralized collection
2. **Better Debugging**: Logs are structured and can be analyzed systematically
3. **Performance**: More efficient logging with proper level filtering
4. **Error Handling**: Graceful fallback when backend logging fails
5. **Consistency**: Single logging approach across entire frontend

### Logger Features
- **Drop-in replacement**: Same API as console methods
- **Automatic component detection**: Extracts component names from stack traces
- **Backend integration**: Routes all logs through Tauri to unified backend logging
- **Log levels**: Supports info, warn, error, debug levels
- **Fallback protection**: Falls back to console if backend fails

### Examples

#### Basic Logging
```typescript
import { logger } from '@/lib/logger';

// Info logging
logger.log('User action completed');
logger.info('Component mounted');

// Warning logging  
logger.warn('Deprecated feature used');

// Error logging
logger.error('Failed to load data:', error);

// Debug logging
logger.debug('State change:', { oldState, newState });
```

#### Error Handling
```typescript
try {
  const result = await api.fetchData();
  logger.info('Data fetched successfully');
} catch (error) {
  logger.error('Failed to fetch data:', error);
}
```

#### Complex Data Logging
```typescript
const debugData = {
  userId: user.id,
  timestamp: Date.now(),
  action: 'button_click'
};

logger.debug('User interaction:', debugData);
```

### JSDoc Examples
When writing JSDoc comments with code examples, also use logger:

```typescript
/**
 * Example component usage
 * 
 * @example
 * <MyComponent 
 *   onSelect={(item) => logger.log('Selected:', item)}
 *   onError={(error) => logger.error('Error:', error)}
 * />
 */
```

## Component Development Guidelines

### File Structure
- Use entity-based organization (agents/, projects/, sessions/)
- Follow Atomic Design patterns (atoms → molecules → organisms)
- Export components from index.ts files

### Naming Conventions
- **PascalCase** for component files: `ProjectCard.tsx`
- **Entity prefixes**: Clear domain boundaries (AgentCard, ProjectList)
- **Descriptive names**: Avoid abbreviations

### Imports Order
```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. External libraries
import { motion } from 'framer-motion';

// 3. Internal components (@ imports)
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

// 4. Relative imports
import './styles.css';
```

### Error Boundaries
Wrap complex components in ErrorBoundary:

```typescript
import { ErrorBoundary } from '@/components/common';

return (
  <ErrorBoundary>
    <ComplexComponent />
  </ErrorBoundary>
);
```

### Debug Labels
For debugging, use DebugLabel with relative positioning:

```typescript
import { DebugLabel } from '@/components/ui/atoms';

return (
  <div className={cn("existing-classes relative", className)}>
    <DebugLabel label="ComponentName" />
    {/* component content */}
  </div>
);
```

## Performance Guidelines

### State Management
- Use `useState` for local component state
- Use `useCallback` for event handlers passed to children
- Use `useMemo` for expensive computations
- Use context sparingly (only for truly global state)

### Re-renders
- Memoize components that receive complex props
- Extract static objects/arrays outside components
- Use refs for values that don't need to trigger re-renders

### Async Operations
```typescript
const fetchData = async () => {
  try {
    logger.info('Starting data fetch');
    const result = await api.getData();
    logger.info('Data fetch completed');
    return result;
  } catch (error) {
    logger.error('Data fetch failed:', error);
    throw error;
  }
};
```

## Testing Guidelines

### Component Testing
- Test user interactions, not implementation details
- Use meaningful test descriptions
- Mock external dependencies
- Use logger for test debugging when needed

```typescript
import { logger } from '@/lib/logger';

test('should handle user interaction', () => {
  logger.debug('Running user interaction test');
  // test implementation
});
```

## Security Guidelines

### Data Sanitization
- Never log sensitive information (passwords, tokens, API keys)
- Sanitize user input before logging
- Use structured logging for better security analysis

```typescript
// ✅ GOOD - Sanitized logging
logger.info('User login attempt', { 
  userId: user.id, 
  timestamp: Date.now() 
});

// ❌ BAD - Sensitive data logging
logger.info('User login', { 
  password: user.password,  // NEVER LOG PASSWORDS
  apiKey: user.apiKey       // NEVER LOG API KEYS
});
```

## Code Quality Standards

### TypeScript
- Use strict TypeScript configuration
- Define proper interfaces for all props
- Avoid `any` type - use proper typing
- Use type guards for runtime type checking

### Code Style
- Use Prettier for formatting
- Follow ESLint rules
- Use meaningful variable names
- Keep functions small and focused
- Comment complex business logic

### Git Commits
Follow the project's commit message format:
```
feat: add new component for user settings

- Implement UserSettingsForm component
- Add validation for email and password fields  
- Integrate with backend API

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Remember

1. **ALWAYS use `logger` instead of `console`** - This is non-negotiable
2. **Import logger in every file that needs logging**
3. **Use appropriate log levels** (info for general info, error for errors, etc.)
4. **Keep the codebase consistent** - follow these guidelines religiously
5. **When in doubt, check existing components** for patterns and examples

The centralized logger system is now the standard for ALL frontend development. Any use of console methods will be considered a bug and should be fixed immediately.