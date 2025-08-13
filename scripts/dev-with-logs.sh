#!/bin/bash

# Enable Tauri logging to file
export RUST_LOG=info
export RUST_LOG_STYLE=never
export CLAUDIO_LOG_FILE=true

echo "🔧 Starting Claudio with logging enabled..."
echo "📝 Logs will be written to: ~/.claude/logs/claudio.log"
echo ""

# Start the development server
npm run tauri dev