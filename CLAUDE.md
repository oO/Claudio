# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY Commit Message Format

**ALWAYS USE THIS EXACT FORMAT FOR EVERY COMMIT - NO EXCEPTIONS:**

```
type: brief description (vX.X.X)

- Bullet point describing change 1
- Bullet point describing change 2

Designed with ❤️ by oO. Coded with ✨ by Claude Sonnet 4
Co-authored-by: Claude.AI <noreply@anthropic.com>
```

**Types**: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

## Commit Management

**MANDATORY: Always delegate commits to the commit-expert subagent**

```javascript
// Use Task tool to delegate to commit-expert
Task({
  subagent_type: "commit-expert", 
  description: "Create commit for [feature/fix description]",
  prompt: `Handle the complete commit workflow for [describe changes].
  
  Context needed:
  - Summary of what was implemented/changed/fixed
  - Key files or components affected  
  - Any breaking changes or migrations required
  - Special considerations for version increment
  - Target audience impact (users/developers/system)`
})
```

**The commit-expert will automatically:**
- Analyze all git changes and categorize by impact
- Determine appropriate semantic version increment
- Verify TypeScript and Rust builds pass
- Update CHANGELOG.md with structured entries
- Create properly formatted commit following project standards
- Handle version synchronization between package.json and Cargo.toml

**Never create commits manually** - always use the commit-expert subagent to ensure consistency, proper versioning, and comprehensive documentation.

## Development Commands

### Core Development
```bash
# Development with auto-reload
npm run dev              # Frontend only (Vite dev server)
npm run tauri dev        # Full stack with Tauri backend

# Building
npm run build           # TypeScript compilation + Vite build
npm run tauri build     # Full application build (all platforms)

# Type checking
npm run check           # Frontend + backend type/syntax check
tsc --noEmit           # Frontend TypeScript check only
cd src-backend && cargo check  # Rust syntax check only
```

### Version Management
```bash
npm run sync-version    # Sync version between package.json and Cargo.toml
# Automatically runs before build/dev
```

### Tauri Commands
```bash
npm run tauri dev       # Development with hot reload
npm run tauri build     # Production build
npm run tauri info      # System info for debugging
```

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
- **`checkpoint/`** - Session checkpoint management and timeline features

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
2. **Session Streaming**: Real-time JSONL parsing with checkpoint support
3. **Claude Integration**: Native Task tool delegation via Tauri commands
4. **Analytics**: PostHog integration with resource monitoring

## Project Standards

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
- Real-time session streaming from JSONL files
- Checkpoint system for session branching
- Usage analytics with token/cost tracking

## Development Notes

### Version Management
- Semantic versioning with automatic sync between package.json and Cargo.toml
- v0.x.x indicates pre-1.0 with no backward compatibility guarantees

### Analytics Integration
- PostHog for usage tracking (opt-out available)
- Resource monitoring for performance insights
- Error boundary integration for crash reporting

### Agent Collaboration
Always delegate to the best available sub-agent for the task using Claude Code's native Task tool.