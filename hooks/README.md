# Claudio Claude Code Hooks

This directory contains hook scripts that integrate with Claude Code to track active sessions in the Claudio UI.

## What These Hooks Do

These hooks allow Claudio to detect and display regular Claude Code sessions (not managed by Claudio) as "Live" in the project UI.

### `session-start.sh`
- Triggers when any Claude Code session starts
- Ignores Claudio-managed sessions (identified by `CLAUDIO_ID` env var)
- Creates a tracking file in `~/.claudio/projects/<project_id>/claude-<session_id>.json`
- Extracts project information from Claude's transcript path

### `session-end.sh`  
- Triggers when any Claude Code session ends normally
- Removes the corresponding tracking file
- Cleans up session state automatically

## Installation

These hooks are automatically installed by Claudio into the user's `~/.claude/settings.json` file when Claudio first runs.

The installation adds entries like:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "~/.claude/hooks/session-start.sh"
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "~/.claude/hooks/user-prompt-submit.sh"
      }
    ],
    "Stop": [
      {
        "type": "command", 
        "command": "~/.claude/hooks/stop.sh"
      }
    ],
    "SessionEnd": [
      {
        "type": "command",
        "command": "~/.claude/hooks/session-end.sh"
      }
    ]
  }
}
```

## How It Works

### Session Lifecycle
1. **SessionStart hook** → Creates `claude-<session_id>.json` with `status: "idle"`
2. **UserPromptSubmit hook** → Updates status to `"thinking"` + emits real-time event
3. **Stop hook** → Updates status to `"idle"` + ends thinking event  
4. **SessionEnd hook** → Deletes `claude-<session_id>.json`

### UI Integration
1. **Claudio scans** `~/.claudio/projects/*/claude-*.json` files for live sessions
2. **Real-time events** provide thinking titles and haikus via `claude-session-thinking` event
3. **Frontend displays** beautiful thinking status just like Claudio-managed sessions

## Session Tracking Files

Files created in `~/.claudio/projects/<project_id>/claude-<session_id>.json`:

```json
{
  "session_id": "abc123-def456-...",
  "project_dir": "/Users/user/Projects/myapp",
  "started_at": "2025-08-27T17:30:00Z", 
  "transcript_path": "/Users/user/.claude/projects/-Users-user-Projects-myapp/abc123.jsonl",
  "source": "startup",
  "type": "claude_session"
}
```

## Troubleshooting

### Enable Debug Logging
Uncomment the logging lines in both scripts to write to `~/.claudio/session-hooks.log`:
```bash
echo "[$(date)] Claude session started: $session_id in $PROJECT_ID" >> "$HOME/.claudio/session-hooks.log"
```

### Check Hook Installation
Verify hooks are installed in `~/.claude/settings.json`:
```bash
cat ~/.claude/settings.json | jq .hooks
```

### Manual Cleanup
If sessions show as "live" incorrectly, manually remove stale files:
```bash
rm ~/.claudio/projects/*/claude-*.json
```

## Environment Variables Available

These environment variables are provided by Claude Code to the hooks:

- `session_id` - Unique UUID for the Claude session
- `transcript_path` - Path to the conversation JSONL file  
- `CLAUDE_PROJECT_DIR` - Working directory where Claude was started
- `source` - How session started ("startup", "resume", "clear")
- `hook_event_name` - Always "SessionStart" or "SessionEnd"
- `CLAUDIO_ID` - Present only for Claudio-managed sessions

## Architecture Notes

- **File-based tracking** - Simple, reliable, no database dependencies
- **Per-session files** - No file contention, atomic operations  
- **Project-scoped** - Sessions organized by project for easy lookup
- **Cleanup on exit** - Files removed when sessions end normally
- **Crash handling** - Stale files may remain if Claude crashes (acceptable)

## Future Enhancements

- Real-time API notifications to Claudio backend
- Session heartbeat/health checking  
- Integration with Claudio's session management
- More sophisticated cleanup strategies