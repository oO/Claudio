#!/bin/bash

# Claudio SessionEnd Hook - Removes session file
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Log all hook input data for debugging (session-specific log file)
if [ -n "$SESSION_ID" ]; then
    LOG_FILE="$HOME/.claudio/claudio-hooks-$SESSION_ID.log"
    echo "=== SessionEnd Hook $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> "$LOG_FILE"
    echo "$INPUT" | jq '.' >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# Skip Claudio-managed sessions  
if [ -n "$CLAUDIO_ID" ]; then
    exit 0
fi

if [ -z "$SESSION_ID" ] || [ -z "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# Extract project_id and remove session file
PROJECT_ID=$(echo "$TRANSCRIPT_PATH" | sed -n 's/.*\/projects\/\([^\/]*\)\/.*/\1/p')
if [ -n "$PROJECT_ID" ]; then
    SESSION_FILE="$HOME/.claudio/projects/$PROJECT_ID/claude-$SESSION_ID.json"
    rm -f "$SESSION_FILE"
fi

# Output space to make hook appear in .jsonl
echo " "
