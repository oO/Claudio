# Purpose

Expert development assistance for the **Claudio** project - a Claude Code Native Agent Manager built on Tauri.

## MANDATORY Commit Message Format

**ALWAYS USE THIS EXACT FORMAT FOR EVERY COMMIT - NO EXCEPTIONS:**

```
type: brief description (vX.X.X)

- Bullet point describing change 1
- Bullet point describing change 2

Designed with ❤️ by oO. Coded with ✨ by Claude Opus 4.1
Co-authored-by: Claude.AI <noreply@anthropic.com>
```

**Types**: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

## Commit Management

**MANDATORY: Always delegate commits to the commit-expert subagent**
**Never create commits manually** - always use the commit-expert subagent to ensure consistency, proper versioning, and comprehensive documentation.

## Development Commands

## !IMPORTANT: Application Lifecycle Management

**NEVER start, stop, kill, or restart the Claudio application from agents/code!**

- Only the user should start/stop the Claudio app
- Agents cannot interact with UI buttons anyway
- User needs to see logs and control the development process
- If restart is needed, ask the user to restart manually
- Use `cargo check` for compilation verification, not `cargo run` or `npm run tauri dev`
- the user starts the application in dev mode with
  `RUST_LOG=debug npm run tauri dev`
  logs are automatically written to `~/Library/Logs/Claudio/claudio.log`
  (previous session logs saved as `claudio.prev.log`)

## Project Architecture

Claudio is a **Claude Code Native Agent Manager** built on Tauri (Rust backend + React frontend) that provides visual management for Claude Code's native subagent system.

### High-Level Architecture
```
┌─────────────────────────────────────────┐
│           Frontend (React/TS)           │
├─────────────────────────────────────────┤
│ • Tab-based interface (projects/agents) │
│ • Entity-based component organization   │
│ • Real-time session streaming           │
│ • Atomic Design System (atoms/molecules)│
└─────────────────────────────────────────┘
                    │
              Tauri Bridge
                    │
┌─────────────────────────────────────────┐
│           Backend (Rust)                │
├─────────────────────────────────────────┤
│ • File-based agent storage (.md files)  │
│ • Claude Code integration & execution   │
│ • Session management & analytics        │
│ • Project discovery & management        │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         Storage (File-based)            │
├─────────────────────────────────────────┤
│ ~/.claude/projects/*/                   │
│ ~/.claude/agents/*.md                   │
│ <project>/.claude/agents/*.md           │
│ <project>/.claude/settings.json         │
└─────────────────────────────────────────┘
```

### Key Backend Modules
- **`commands/claude/`** - Core Claude Code integration (projects, sessions, execution)
- **`commands/agents.rs`** - Agent CRUD operations and execution management
- **`commands/usage.rs`** - Usage analytics and session statistics
- **`commands/mcp.rs`** - Model Context Protocol server management

### Frontend Component Architecture
Components follow entity-based organization with Atomic Design patterns:

```
src-frontend/components/
├── agents/          # Agent management UI
├── projects/        # Project browser and settings
├── sessions/        # Session timeline and execution
├── claude/          # Claude-specific features (binary, memory)
├── mcp/            # MCP server management
├── settings/       # Application settings
├── dashboard/      # Usage analytics dashboard
├── tools/          # Tool execution widgets
├── common/         # Shared components
└── ui/             # Atomic Design System
    ├── atoms/      # Basic elements (buttons, badges)
    ├── molecules/  # Composed elements (forms, controls)
    └── organisms/  # Complex sections (tables, editors)
```

### Data Flow Patterns
1. **Agent Management**: File-based storage with dual-level discovery (user/project)
2. **Session Streaming**: Real-time JSONL parsing with UUID-based deduplication
3. **Claude Integration**: Native Task tool delegation via Tauri commands
4. **Analytics**: PostHog integration with resource monitoring

## Project Standards

### Logging Standards
- Keep log messages short and direct
- No emojis, no ALL CAPS, no excessive punctuation
- One success log per operation, not progress narration
- Include essential context: what happened, why, with what data
- Use appropriate levels: ERROR, WARN, INFO, DEBUG

### Code Conventions
- **Rust backend**: `snake_case` for functions and parameters
- **Frontend**: `snake_case` for function names, `camelCase` for parameters
- **Tauri bridge**: Automatic conversion (`project_path` → `projectPath`)

### Component Naming
- **PascalCase** for component files: `ProjectCard.tsx`
- **Entity prefixes**: Clear domain boundaries (AgentCard, ProjectList)
- **Descriptive names**: Avoid abbreviations

### File Organization
- **Entity-based**: Group by domain (agents/, projects/, sessions/)
- **Atomic Design**: UI components follow atoms → molecules → organisms
- **Index exports**: Each folder has index.ts for clean imports

## Key Integration Points

### Claude Code Native Integration
- Uses Claude Code's native Task tool with `subagent_type` parameter
- Session tracking via native Claude Code session files
- Project discovery through `~/.claude/projects/` scanning

### Agent File Format
Agents stored as `.md` files with YAML frontmatter:
```yaml
---
name: "Agent Name"
description: "Agent description"
subagent_type: "specialized-agent-type"
tools: ["tool1", "tool2"]
---
Agent prompt content here...
```

### Session Management
**Two-Tier Session Architecture:**
- **Claudio Sessions**: High-level wrapper sessions that connect discrete Claude CLI turns
- **Claude Sessions**: Individual native Claude Code .jsonl files containing actual conversation data
- **Resume Flow**: New turns use `claude --resume <session_id>` to continue conversations
- **Message Streaming**: Real-time JSONL parsing with UUID-based deduplication for resumed sessions

**Session States:**
1. New Claudio session → Creates fresh Claude session
2. Continuing Claudio session → Resumes previous Claude session, copies all messages as context
3. Native Claude session → Direct .jsonl file access without Claudio wrapper

**Cleanup & Memory:**
- In-memory cache stores active session state (single source of truth)
- Automatic cleanup when previous session messages appear in resumed sessions
- Session history maintained for debugging and analytics

## Development Notes

### Version Management
- Semantic versioning with automatic sync between package.json and Cargo.toml
- v0.x.x indicates pre-1.0 with no backward compatibility guarantees

### Analytics Integration
- PostHog for usage tracking (opt-out available)
- Resource monitoring for performance insights
- Error boundary integration for crash reporting

### Settings Architecture

**Two Completely Separate Settings Systems - DO NOT UNIFY!**

#### 1. Claudio App Settings (Our Control)
- **Purpose**: Window position, tabs, proxy, theme, telemetry - app-only settings
- **Storage**: `~/.claudio/settings.json` (global only, no project-level complexity)
- **Implementation**: Simple in-memory cache with flush-on-change (`claudio_app_settings.rs`)
- **Frontend API**: `useClaudioAppSettings()` - optimistic updates, instant UI response
- **No watchers needed** - only our app reads/writes this file

#### 2. Claude Code Settings (Shared Control)
- **Purpose**: Model config, permissions, API keys - shared with Claude Code binary
- **Storage**: Multi-layered files that Claude Code binary also modifies
  - `~/.claude/settings.json` (global)
  - `project/.claude/settings.json` (project shared)
  - `project/.claude/settings.local.json` (project local)
- **Implementation**: Complex orchestrator with file watchers (`claude_code_settings.rs`)
- **Frontend API**: `useClaudeCodeSettings(projectPath)` - validated updates, external change detection
- **Requires orchestration** - both our app and Claude Code binary can modify simultaneously

#### Why Two Systems?
1. **Different ownership models** - we control vs shared control
2. **Different complexity needs** - simple cache vs multi-layer precedence
3. **Different UX patterns** - optimistic vs validated updates
4. **KISS principle** - each system optimized for its purpose

#### Naming Convention
- **ClaudioAppSettings** / **claudio_app_settings.rs** - Our app's settings only
- **ClaudeCodeSettings** / **claude_code_settings.rs** - Shared Claude Code settings
- **Never unify these** - they serve fundamentally different purposes

### Agent Collaboration
Always delegate to the best available sub-agent for the task using Claude Code's native Task tool.
- add the info about the log file to the logging section