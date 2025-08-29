#!/bin/bash

# Claudio Session End Hook  
# Removes regular Claude Code session tracking when sessions end

# Exit early if this is a Claudio-managed session
if [ -n "$CLAUDIO_ID" ]; then
    exit 0
fi

# Extract project_id from transcript_path
# Example: /Users/user/.claude/projects/-Users-user-Projects-myapp/session123.jsonl
# Extract: -Users-user-Projects-myapp
PROJECT_ID=$(echo "$transcript_path" | sed -n 's/.*\/projects\/\([^\/]*\)\/.*/\1/p')

if [ -z "$PROJECT_ID" ]; then
    # Could not extract project ID, nothing to clean up
    exit 0
fi

# Remove the session file
SESSION_FILE="$HOME/.claudio/projects/$PROJECT_ID/claude-$session_id.json"
rm -f "$SESSION_FILE"

# Optional: Debug logging (uncomment for troubleshooting)
# echo "[$(date)] Claude session ended: $session_id in $PROJECT_ID" >> "$HOME/.claudio/session-hooks.log"