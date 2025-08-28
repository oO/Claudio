---
name: Claude Code CLI vs Settings Reference
description: Comprehensive comparison of command line flags vs settings.json configuration options for Claude Code
version: 1.0
claude_version: 1.0.93
date_created: 2025-08-27
last_updated: 2025-08-27
type: reference
tags: [cli, settings, configuration, permissions, tools]
---

> ⚠️ **Note**: Claude Code features evolve rapidly. This document reflects the state as of version 1.0.93. Always check `claude --help` for the latest options.

## Overview

This document provides a comprehensive comparison of features that can be controlled via command line flags versus `settings.json` configuration files in Claude Code.

## Feature Overlap Matrix

### ✅ Available in BOTH Command Line AND Settings.json

| Feature | CLI Flag | Settings.json Key | Notes |
|---------|----------|------------------|--------|
| **Additional Directories** | `--add-dir <dirs...>` | `permissions.additionalDirectories` | CLI adds to settings list |
| **Allowed Tools** | `--allowed-tools <tools...>` | `permissions.allow` or `allowedTools` | Multiple formats supported |
| **Disallowed Tools** | `--disallowed-tools <tools...>` | `permissions.deny` | CLI overrides settings |
| **Model Selection** | `--model <model>` | `model` | CLI takes precedence |
| **Permission Mode** | `--permission-mode <mode>` | `defaultMode` | Choices: acceptEdits, bypassPermissions, default, plan |
| **System Prompt** | `--append-system-prompt <prompt>` | `append_system_prompt` | Appends to default system prompt |
| **MCP Configuration** | `--mcp-config <configs...>` | `mcpServers` | Different syntax formats |

### 🚫 COMMAND LINE ONLY

These features can **ONLY** be controlled via CLI flags:

#### Session Management
```bash
--continue                          # Continue most recent conversation
--resume [sessionId]                # Resume specific session  
--session-id <uuid>                # Use specific session ID
```

#### Input/Output Control
```bash
--print                            # Non-interactive mode
--output-format <format>           # text, json, stream-json
--input-format <format>            # text, stream-json
--replay-user-messages             # Re-emit user messages (stream-json only)
```

#### Debug & Development
```bash
--debug [filter]                   # Debug mode with optional filtering
--verbose                          # Override verbose setting from config
--mcp-debug                        # [DEPRECATED] MCP debug mode
```

#### Security & Advanced
```bash
--dangerously-skip-permissions     # Bypass all permission checks
--strict-mcp-config               # Only use CLI MCP config, ignore others
--fallback-model <model>          # Fallback when default overloaded (print only)
--ide                            # Auto-connect to IDE on startup
--settings <file-or-json>        # Load additional settings from file/JSON
```

### ⚙️ SETTINGS.JSON ONLY

These features can **ONLY** be controlled via settings files:

#### Automation & Hooks
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(*.py)",
        "hooks": [
          {
            "type": "command", 
            "command": "python -m black $file"
          }
        ]
      }
    ],
    "PreCompact": [...],
    "SessionStart": [...],
    "SessionEnd": [...]
  }
}
```

#### Environment Configuration
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "ANTHROPIC_API_KEY": "your-key",
    "OTEL_METRICS_EXPORTER": "otlp"
  }
}
```

#### Project-Specific Settings
```json
{
  "projects": {
    "/path/to/project": {
      "mcpServers": {
        "filesystem": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/dir"]
        }
      }
    }
  }
}
```

#### Advanced Permissions
```json
{
  "permissions": {
    "additionalDirectories": ["../docs/", "../shared/"],
    "allow": [
      "Bash(npm run lint)",
      "Bash(git log:*)",
      "Read(~/.zshrc)",
      "Glob", "Grep", "LS", "Read", "Edit", "Write"
    ],
    "deny": [
      "Bash(curl:*)",
      "Read(./.env)",
      "Write(./production.config.*)"
    ]
  }
}
```

#### Performance & Limits
```json
{
  "maxTokens": 4096,
  "cleanupPeriodDays": 30,
  "disableAllHooks": false
}
```

## Configuration File Hierarchy

Settings are applied in this priority order (highest to lowest):

1. **CLI flags** (highest priority - always wins)
2. **`--settings <file>`** specified file
3. **`.claude/settings.local.json`** (project-local, gitignored)
4. **`.claude/settings.json`** (project-shared, committed)
5. **`~/.claude/settings.json`** (user global)
6. **Enterprise managed policies** (can override everything)
   - macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`
   - Linux/WSL: `/etc/claude-code/managed-settings.json` 
   - Windows: `C:\ProgramData\ClaudeCode\managed-settings.json`

## Usage Patterns & Best Practices

### For Development Teams
```json
// .claude/settings.json (committed)
{
  "permissions": {
    "allow": ["Bash(npm run:*)", "Bash(git:*)", "Edit", "Write"],
    "additionalDirectories": ["../shared-lib", "../docs"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(*.ts)|Edit(*.ts)",
        "hooks": [{"type": "command", "command": "npm run lint:fix"}]
      }
    ]
  }
}
```

### For Individual Use
```bash
# Override for specific session
claude --model opus --permission-mode acceptEdits --add-dir ../experimental
```

### For CI/CD
```bash
# Non-interactive with strict permissions
claude --print --dangerously-skip-permissions --model sonnet --output-format json
```

## Common Gotchas

1. **Directory Paths**: CLI `--add-dir` and `settings.json` paths are **merged**, not replaced
2. **Tool Permissions**: CLI flags override settings, they don't merge
3. **MCP Config**: `--strict-mcp-config` ignores ALL other MCP configurations
4. **Resume Sessions**: `--resume` only works with existing session IDs
5. **Permission Modes**: Can dramatically change Claude's behavior - test carefully

## Examples

### Combining CLI and Settings
```bash
# Using base settings + CLI overrides
claude --model opus --add-dir ../temp-data -- "analyze this code"
```

### Loading Custom Settings
```bash
# Load specific config file
claude --settings ./ci-config.json --print -- "run tests"
```

### Complex Permission Setup
```json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Read", "Edit"],
    "deny": ["Write(package*.json)"],
    "additionalDirectories": ["../lib"]
  },
  "defaultMode": "acceptEdits",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{"type": "command", "command": "prettier --write $CLAUDE_FILE_PATHS"}]
      }
    ]
  }
}
```

---

## Version History

- **v1.0** (2025-08-27): Initial documentation for Claude Code v1.0.93
- Future versions will be tracked here as Claude Code evolves

## References

- [Claude Code CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)
- [Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)  
- [Hooks Reference](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [IAM Documentation](https://docs.anthropic.com/en/docs/claude-code/iam)

---

*This document is maintained as part of the Claudio project for Claude Code Native Agent Manager. Updates welcome as Claude Code evolves!*