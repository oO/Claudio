# Session Handle Refactor Specification

## Problem
Current session management has race conditions due to multiple async processes trying to manage session state without proper coordination. Frontend tries to track session IDs that change constantly, leading to UI loading old/deleted session files.

## Solution: Session Handle Abstraction
Backend provides a unified session handle that hides the complexity of native session file swapping. UI interacts with stable handles, backend manages all the messy details.

## Architecture

### Frontend (Simple)
```typescript
interface SessionHandle {
  id: string;              // Stable handle ID (claudio-xxx or native session ID)
  type: 'claudio' | 'native';
  onMessage: (callback) => void;     // Stream messages in real-time
  sendPrompt: (prompt) => Promise<void>;
  getHistory: () => Promise<Message[]>;  // Get complete history
  destroy: () => void;     // Cleanup
}

// Usage
const handle = await backend.getSessionHandle(sessionId);
handle.onMessage(msg => displayMessage(msg));
await handle.sendPrompt("hello");
```

### Backend (Complex)
```rust
pub struct SessionOrchestrator {
  claudio_sessions: HashMap<String, ClaudioSessionState>,
  native_sessions: HashMap<String, NativeSessionState>,
  message_streams: HashMap<String, Sender<Message>>,
}

impl SessionOrchestrator {
  // Unified entry point for both session types
  pub async fn get_session_handle(session_id: String) -> SessionHandle;
  
  // Handle message streaming (real-time)
  async fn stream_messages_to_frontend(handle_id: String, messages: Stream<Message>);
  
  // Handle session state updates (atomic)
  async fn update_session_state(handle_id: String, new_state: SessionState);
}
```

## Implementation Plan

### Phase 1: Backend Session Orchestrator
1. Create `SessionOrchestrator` struct in new file `session_orchestrator.rs`
2. Implement unified session handle management
3. Move session creation/management logic from `claude_direct.rs` 
4. Create streaming message interface separate from metadata updates

### Phase 2: Frontend Simplification  
1. Replace `ClaudeCodeSession.tsx` complex state management with simple handle-based approach
2. Remove `activeClaudeSessionId` state tracking
3. Use session handle for all operations
4. Keep streaming UI for real-time feel

### Phase 3: Integration
1. Update Tauri commands to use orchestrator
2. Test session creation, resumption, and streaming
3. Verify no race conditions in session switching

## Key Principles
- **Backend does ALL heavy lifting**: session IDs, file management, cleanup
- **Frontend is purely reactive**: displays what backend streams
- **Streaming preserved**: messages appear in real-time like terminal
- **Abstraction hides complexity**: UI doesn't know about session file swapping
- **No race conditions**: backend coordinates all async operations

## Files to Modify
- `src-backend/src/commands/session_orchestrator.rs` (NEW)
- `src-backend/src/commands/claude_direct.rs` (refactor)
- `src-frontend/components/sessions/ClaudeCodeSession.tsx` (simplify)
- `src-frontend/lib/api.ts` (update to use handles)

## Success Criteria
- No more "session file not found" errors
- UI updates properly when resuming sessions  
- Messages stream in real-time
- Session switching happens seamlessly
- No frontend session state management complexity

## Rollback Plan
Git branch `feature/session-handles` - can revert if issues arise.