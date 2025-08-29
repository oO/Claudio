#!/bin/bash

# Claudio SessionStart Hook - Session Lifecycle Management
# Creates tracking file for regular Claude Code sessions (non-Claudio managed)

# Exit early if this is a Claudio-managed session
if [ -n "$CLAUDIO_ID" ]; then
    exit 0
fi

# Extract project_id from transcript_path
# Example: /Users/user/.claude/projects/-Users-user-Projects-myapp/session123.jsonl
# Extract: -Users-user-Projects-myapp
PROJECT_ID=$(echo "$transcript_path" | sed -n 's/.*\/projects\/\([^\/]*\)\/.*/\1/p')

if [ -z "$PROJECT_ID" ]; then
    # Could not extract project ID, skip tracking
    exit 0
fi

# Create the session file path in Claudio's project structure
CLAUDIO_PROJECT_DIR="$HOME/.claudio/projects/$PROJECT_ID"
SESSION_FILE="$CLAUDIO_PROJECT_DIR/claude-$session_id.json"

# Create directory if it doesn't exist
mkdir -p "$CLAUDIO_PROJECT_DIR"

# Write initial session data with idle status
cat > "$SESSION_FILE" << EOF
{
  "session_id": "$session_id",
  "project_dir": "$CLAUDE_PROJECT_DIR",
  "started_at": "$(date -Iseconds)",
  "transcript_path": "$transcript_path",
  "source": "$source",
  "status": "idle",
  "type": "claude_session"
}
EOF

# Optional: Debug logging (uncomment for troubleshooting)
# echo "[$(date)] Claude session started: $session_id in $PROJECT_ID" >> "$HOME/.claudio/session-hooks.log"