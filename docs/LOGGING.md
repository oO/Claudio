# 🔍 Claudio Logging Guide

## Enable File Logging

### Method 1: Using the Dev Script (Recommended)
```bash
./scripts/dev-with-logs.sh
```

### Method 2: Manual Environment Variables
```bash
export RUST_LOG=info
export RUST_LOG_STYLE=never
export CLAUDIO_LOG_FILE=true
npm run tauri dev
```

### Method 3: Production Logging
```bash
export RUST_LOG=info
export CLAUDIO_LOG_FILE=true
npm run tauri build
./src-backend/target/release/claudio
```

## Log Locations

- **Backend (Rust)**: `~/.claude/logs/claudio.log`
- **Frontend (Browser)**: Browser DevTools Console
- **Memory Monitoring**: Browser DevTools Console (look for `[Memory - *]` messages)

## Log Levels

Set `RUST_LOG` to different levels:
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - Information, warnings, and errors (recommended)
- `debug` - Debug info, information, warnings, and errors
- `trace` - Everything (very verbose)

## Target Specific Modules

```bash
# Only log from specific modules
export RUST_LOG=claudio=debug,tauri=info

# Log all Claudio internals
export RUST_LOG=claudio::commands=debug

# Log memory-related operations
export RUST_LOG=claudio::commands::claude=debug
```

## What Gets Logged

### Backend Operations
- Project scanning and session loading
- Claude Code execution and process management
- Agent execution and management
- File I/O operations
- Checkpoint and timeline management
- Error conditions and warnings

### Frontend Memory Monitoring
- Real-time JavaScript heap usage
- Virtual scrolling performance metrics
- Component lifecycle events
- Memory leak detection warnings
- Event listener cleanup tracking

## Analyzing Memory Issues

### 1. Enable Frontend Memory Debug Panel
```javascript
// In browser console
localStorage.setItem('claudio-debug-memory', 'true')
```

### 2. Look for Memory Leak Patterns in Logs
```bash
# Watch logs in real-time
tail -f ~/.claude/logs/claudio.log

# Filter for memory-related issues
grep -i "memory\|leak\|cleanup" ~/.claude/logs/claudio.log
```

### 3. Frontend Console Messages
Look for these patterns in browser console:
- `[Memory - ProjectSessionTab]` - Virtual scrolling memory usage
- `🧹 ProjectSessionTab: Cleaning up` - Event listener cleanup
- `🔥 MEMORY LEAK DETECTED` - Automatic leak detection
- `⚠️ High memory usage detected` - Memory usage warnings

## Common Memory Issues

### 1. Event Listener Leaks
Look for missing cleanup messages:
```
🧹 ProjectSessionTab: Cleaning up scroll listeners
🧹 ProjectSessionTab: Cleaning up height calculation listeners
```

### 2. Virtual Scrolling Issues
Monitor these metrics:
- Session Count vs Virtual Items ratio
- Memory usage during scrolling
- Growing memory trend during session browsing

### 3. Backend Process Accumulation
Watch for:
- Claude Code processes not terminating
- Agent execution processes piling up
- File watchers not being cleaned up

## Emergency Memory Commands

### Force Garbage Collection
```javascript
// In browser console (requires --expose-gc flag)
window.gc()
```

### Clear Frontend State
```javascript
// Clear all localStorage
localStorage.clear()

// Clear memory debug flag
localStorage.removeItem('claudio-debug-memory')
```

### Kill Stuck Processes
```bash
# Kill all Claude Code processes
pkill -f "claude code"

# Kill all node processes (careful!)
pkill -f "node.*claudio"
```

## Log Analysis Examples

### Find Memory Growth Patterns
```bash
grep "Memory.*MB" ~/.claude/logs/claudio.log | tail -20
```

### Track Session Loading Performance
```bash
grep "Getting sessions for project" ~/.claude/logs/claudio.log
```

### Monitor Process Cleanup
```bash
grep -E "(cleanup|kill|terminate)" ~/.claude/logs/claudio.log
```

## Debugging Tips

1. **Start with fresh logs**: Delete `~/.claude/logs/claudio.log` before testing
2. **Use both backend and frontend logging**: Memory issues can span both layers  
3. **Monitor during specific actions**: Focus logging during commit operations or large session loading
4. **Compare memory trends**: Look for consistent growth patterns vs normal fluctuations
5. **Check process states**: Use Activity Monitor/htop to see process memory usage