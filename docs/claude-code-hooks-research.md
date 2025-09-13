# Claude Code Hooks Research Report

## Executive Summary

Claude Code has significantly expanded its hooks system in 2024-2025, introducing new hook events, enhanced data passing, and improved automation capabilities. This research documents the current state of hooks in Claudio and opportunities for leveraging new features.

## Current Claudio Hooks Implementation

### Existing Hook Usage in Claudio

Claudio currently uses 4 primary hooks for session tracking:

1. **SessionStart** → `claudio-session-start.sh`
2. **UserPromptSubmit** → `claudio-session-active.sh`  
3. **Stop** → `claudio-session-idle.sh`
4. **SessionEnd** → `claudio-session-end.sh`

**Hook Installation Location**: `~/.claude/hooks/`

**Configuration**: Stored in `~/.claude/settings.json`

### Current Hook Architecture

```rust
// From src/commands/hook_installer.rs
settings["hooks"] = json!({
    "SessionStart": [{
        "hooks": [{
            "type": "command",
            "command": "~/.claude/hooks/claudio-session-start.sh"
        }]
    }],
    // ... other hooks
});
```

**Data Flow**: Hooks receive JSON via stdin with session metadata and create tracking files for native Claude Code sessions.

## New Claude Code Hooks Features (2024-2025)

### Expanded Hook Events

Claude Code now supports **9 hook events** (we only use 4):

| Hook Event | Current Usage | New Opportunities |
|------------|--------------|-------------------|
| `PreToolUse` | ❌ Not used | Tool validation, security checks |
| `PostToolUse` | ❌ Not used | Result analysis, logging |
| `Notification` | ❌ Not used | Desktop notifications, alerts |
| `UserPromptSubmit` | ✅ Session tracking | Prompt enhancement, validation |
| `Stop` | ✅ Session state | Performance metrics, cleanup |
| `SubagentStop` | ❌ Not used | Subagent monitoring, chaining |
| `PreCompact` | ❌ Not used | Context optimization alerts |
| `SessionStart` | ✅ Session creation | Enhanced project setup |
| `SessionEnd` | ✅ Session cleanup | Analytics, reporting |

### Enhanced Data Passing

**New Hook Input Structure** (2025):
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/current/working/directory",
  "project_id": "extracted-project-id",
  // Event-specific data varies by hook type
}
```

**Advanced Output Control**:
- Exit codes for simple responses
- JSON output for complex decisions
- Permission control (allow/deny/ask)
- Context injection capabilities

### Decision Control Features

**PreToolUse Hooks** can now:
- `"allow"` - Bypass permission system
- `"deny"` - Block tool execution with reason
- `"ask"` - Request user confirmation

**PostToolUse Hooks** can:
- `"block"` - Provide automated feedback
- Inject results into context

**UserPromptSubmit Hooks** can:
- `"block"` - Prevent prompt processing
- Add `additionalContext` to conversation

## Opportunities for Claudio Enhancement

### 1. Tool Usage Analytics

**PreToolUse + PostToolUse** hooks could provide:
- Real-time tool usage metrics
- Performance tracking per tool
- Security validation for risky operations
- Tool usage patterns analysis

### 2. Enhanced Subagent Management

**SubagentStop** hooks could enable:
- Automatic subagent chaining
- Result validation and retry logic
- Subagent performance monitoring
- Custom subagent result processing

### 3. Smart Notifications

**Notification** hooks could provide:
- Desktop notifications for long operations
- Slack/Discord integration for team workflows  
- Custom alert routing based on content
- Status updates for background processes

### 4. Context Optimization

**PreCompact** hooks could:
- Alert users before context loss
- Save important context to external storage
- Trigger custom compaction strategies
- Maintain conversation continuity

### 5. Advanced Session Management

Enhanced **SessionStart/End** hooks could:
- Auto-setup development environments
- Project-specific initialization scripts
- Cleanup and resource management
- Session analytics and reporting

## Implementation Recommendations

### Phase 1: Core Monitoring
```rust
// Add new hooks to hook_installer.rs
"PreToolUse": [{
    "matcher": "*",
    "hooks": [{
        "type": "command", 
        "command": "~/.claude/hooks/claudio-tool-pre.sh"
    }]
}],
"PostToolUse": [{
    "matcher": "*",
    "hooks": [{
        "type": "command",
        "command": "~/.claude/hooks/claudio-tool-post.sh"
    }]
}]
```

### Phase 2: Smart Features
- Implement SubagentStop for agent orchestration
- Add Notification hooks for user feedback
- Integrate PreCompact for context management

### Phase 3: Advanced Analytics
- Tool usage dashboards
- Performance metrics collection
- Predictive workflow optimization
- Custom automation workflows

## Security Considerations

**New Risks with Expanded Hooks**:
- PreToolUse hooks can modify tool behavior
- Expanded data passing increases attack surface
- JSON output parsing requires validation

**Mitigation Strategies**:
- Validate all hook inputs/outputs
- Use allowlists for permitted tools
- Implement hook sandboxing
- Regular security audits of hook scripts

## Technical Architecture Updates Needed

### Backend Changes Required
1. **Hook Configuration Management**
   - Extend `src/commands/claude/hooks.rs` 
   - Add support for new hook types
   - Implement matcher patterns for tools

2. **Enhanced Data Passing**
   - Update hook script templates
   - Add environment variable support  
   - Implement JSON output parsing

3. **Frontend Integration**
   - Hook management UI updates
   - Real-time hook status display
   - Hook analytics dashboard

### Database Schema Extensions
```sql
-- New table for hook analytics
CREATE TABLE hook_executions (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    hook_type TEXT,
    tool_name TEXT,
    execution_time INTEGER,
    status TEXT,
    created_at TIMESTAMP
);
```

## Migration Strategy

### Backward Compatibility
- Existing hooks continue to work unchanged
- New hooks are opt-in
- Gradual rollout of enhanced features

### Rollout Plan
1. **v0.5.0**: Add PreToolUse/PostToolUse hooks
2. **v0.5.1**: Implement SubagentStop monitoring
3. **v0.6.0**: Full notification system integration
4. **v0.6.1**: Advanced analytics dashboard

## Conclusion

Claude Code's expanded hooks system presents significant opportunities for Claudio enhancement. The new hook events, enhanced data passing, and decision control features enable sophisticated automation workflows and improved user experience.

**Key Takeaways**:
- We're currently using only 44% of available hook events (4/9)
- New decision control features enable proactive tool management
- Enhanced data passing supports richer automation workflows
- Security considerations require careful implementation

**Next Steps**:
1. Implement PreToolUse/PostToolUse hooks for basic monitoring
2. Design UI for managing expanded hook configurations  
3. Develop analytics framework for hook data collection
4. Plan phased rollout of advanced hook features

---

*Research conducted on 2025-09-12 by CloCo for Claudio v0.4.35*