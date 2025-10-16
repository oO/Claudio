#!/bin/bash

# Claudio SessionStart Hook - Creates tracking file for native Claude Code sessions
INPUT=$(cat)

# Parse session data
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Log all hook input data for debugging (session-specific log file)
if [ -n "$SESSION_ID" ]; then
    LOG_FILE="$HOME/.claudio/claudio-hooks-$SESSION_ID.log"
    echo "=== SessionStart Hook $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> "$LOG_FILE"
    echo "$INPUT" | jq '.' >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi
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
  "type": "claude_session",
  "hook": null
}
JSONEOF

# Update hook property with SessionStart payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
jq --arg ts "$TIMESTAMP" --argjson input "$INPUT" \
   '.hook = ($input + {timestamp: $ts})' \
   "$SESSION_FILE" > "$SESSION_FILE.tmp" && mv "$SESSION_FILE.tmp" "$SESSION_FILE"
