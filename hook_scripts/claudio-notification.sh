#!/bin/bash

# Claudio Notification Hook - Updates status to notification
INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# Skip Claudio-managed sessions
if [ -n "$CLAUDIO_ID" ]; then
    exit 0
fi

if [ -z "$SESSION_ID" ] || [ -z "$TRANSCRIPT_PATH" ]; then
    exit 0
fi

# Extract project_id and update status
PROJECT_ID=$(echo "$TRANSCRIPT_PATH" | sed -n 's/.*\/projects\/\([^\/]*\)\/.*/\1/p')
if [ -n "$PROJECT_ID" ]; then
    SESSION_FILE="$HOME/.claudio/projects/$PROJECT_ID/claude-$SESSION_ID.json"
    if [ -f "$SESSION_FILE" ]; then
        sed -i '' 's/"status": "[^"]*"/"status": "notification"/' "$SESSION_FILE"
    fi
fi

# Output space to make hook appear in .jsonl
echo " "
