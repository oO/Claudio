#!/bin/bash

# Claudio SessionStart Hook - Creates tracking file for native Claude Code sessions
INPUT=$(cat)

# Parse session data
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Skip Claudio-managed sessions
if [ -n "$CLAUDIO_ID" ]; then
    exit 0
fi

# Validate required fields
if [ -z "$SESSION_ID" ] || [ -z "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# Extract project_id from transcript_path
PROJECT_ID=$(echo "$TRANSCRIPT_PATH" | sed -n 's/.*\/projects\/\([^\/]*\)\/.*/\1/p')
if [ -z "$PROJECT_ID" ]; then
    exit 0
fi

# Create minimal session file with project_path
CLAUDIO_PROJECT_DIR="$HOME/.claudio/projects/$PROJECT_ID"
SESSION_FILE="$CLAUDIO_PROJECT_DIR/claude-$SESSION_ID.json"
mkdir -p "$CLAUDIO_PROJECT_DIR"

cat > "$SESSION_FILE" << JSONEOF
{
  "session_id": "$SESSION_ID",
  "project_path": "$CWD",
  "status": "idle",
  "type": "claude_session"
}
JSONEOF
