# Backend Development Guidelines

## !IMPORTANT: Application Lifecycle Management

**NEVER start, stop, kill, or restart the Claudio application from agents/code!**

- Only the user should start/stop the Claudio app
- Agents cannot interact with UI buttons anyway  
- User needs to see logs and control the development process
- If restart is needed, ask the user to restart manually
- Use `cargo check` for compilation verification, not `cargo run` or `npm run tauri dev`

## Session Management Architecture

**Claudio Session Flow:**
```rust
// Two-tier session system
// 1. Claudio session (wrapper) -> 2. Claude session (actual .jsonl file)

// Creating new turn in existing Claudio session
let resume_flag = if let Some(last_session) = claudio_session.session_id {
    vec!["--resume".to_string(), last_session]
} else {
    vec![] // First turn - no resume
};
```

**UUID-Based Streaming:**
```rust
// Process messages for resumed sessions
if handle_id.starts_with("claudio-") {
    let claudio_session = get_claudio_session(handle_id, project_path).await?;
    if let Some(last_uuid) = &claudio_session.last_message_uuid {
        // Find UUID position and emit only messages AFTER it
        let start_index = find_uuid_index(&all_messages, last_uuid) + 1;
        emit_messages(&all_messages[start_index..]).await;
    }
}
```

**File Locations:**
- Session orchestrator: `src/commands/session_orchestrator.rs`
- Claudio storage: `src/commands/claudio_storage.rs` 
- Session watcher: `src/commands/claude/session_watcher.rs`
- Claude execution: `src/commands/claude_direct.rs`

## Memory Management Patterns

**In-Memory Cache as Source of Truth:**
```rust
// Global state for active Claudio sessions
static CLAUDIO_SESSIONS: Lazy<Arc<RwLock<HashMap<String, ClaudiaSession>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

// Always read from memory, not disk handles
let session = get_claudio_session_from_memory(&claudio_id)?;
let current_claude_session_id = session.session_id; // Fresh data
```

**Session Handle States:**
1. **New Claudio session**: `session_id: None`, no resume flag
2. **Continuing Claudio**: `session_id: Some(uuid)`, uses resume flag  
3. **Native Claude session**: Hook-tracked via `claude-<session_id>.json` files

## File Watcher & Event System

**Event Flow:**
```rust
// File change detected -> Session watcher -> Event broadcast
pub enum SessionFileEvent {
    Modified { session_id: String, project_id: String, path: PathBuf },
    // ... other variants
}

// Filtered processing in orchestrator
if event_project_id == &project_id && session_id == &current_session_id {
    process_new_messages().await?;
    app_handle.emit("session_message_stream", &streamed_message)?;
}
```

## Session Cleanup System

**Automatic Cleanup Triggers:**
```rust
// When previous session UUID appears in new resumed session
if current_session_uuids.contains(&last_msg_uuid) {
    // Clean up previous session files
    cleanup_session_files(&claudio_session.session_history).await?;
    // Update session history but keep UUID for reference
}
```

## Error Handling Patterns

**Tauri Command Error Handling:**
```rust
#[tauri::command]
pub async fn command_name() -> Result<ReturnType, String> {
    match operation() {
        Ok(result) => Ok(result),
        Err(e) => {
            log::error!("Operation failed: {}", e);
            Err(format!("Failed to execute: {}", e))
        }
    }
}
```

**Async Task Spawning:**
```rust
// Long-running operations should be spawned
tokio::spawn(async move {
    if let Err(e) = background_operation().await {
        log::error!("Background operation failed: {}", e);
    }
});
```

## Claude Code Integration

**Task Tool Delegation:**
```rust
// Use native Claude Code Task tool for subagent execution
let task_prompt = format!(
    "Execute the following task using the {} subagent: {}",
    subagent_type, user_prompt
);

execute_claude_with_task(task_prompt, subagent_type).await?;
```

## Database Operations

**SQLite Connection Management:**
```rust
// Connection per operation, not persistent connections
fn get_connection() -> Result<Connection, rusqlite::Error> {
    let db_path = get_data_dir()?.join("claudio.db");
    Connection::open(db_path)
}

// Always use transactions for multi-step operations
let tx = conn.transaction()?;
// ... operations
tx.commit()?;
```

## Logging Standards

**Structured Logging:**
```rust
// Use contextual information in logs
log::info!("🔍 Looking for last message UUID {} in session {}", uuid, session_id);
log::error!("❌ Failed to process session {}: {}", session_id, error);
log::debug!("📊 Session metrics: messages={}, tokens={}", msg_count, tokens);
```

**Log Levels:**
- `info!()`: Important state changes, user actions
- `warn!()`: Recoverable errors, deprecations  
- `error!()`: Unrecoverable errors, failures
- `debug!()`: Detailed execution flow, debugging data

## Performance Considerations

**File I/O Optimization:**
- Read large session files incrementally when possible
- Cache frequently accessed data in memory
- Use async I/O for all file operations
- Avoid unnecessary file re-reads

**Memory Usage:**
- Clean up completed session handles promptly
- Use Arc<RwLock<>> for shared mutable state
- Prefer streaming over loading entire files
- Monitor memory usage in long-running sessions