# Claudio

Claude Code Native Agent Manager - A visual interface for managing Claude Code's native subagent system.

Designed with ❤️ by oO. Coded with ✨ by Claude Code

> [!WARNING]
> This project is in early development mode. Claudio is being actively transformed from [Claudia](https://github.com/getAsterisk/claudia) to use file-based storage and Claude Code's native Task tool integration. All interfaces and functionality are subject to change.

## 🚀 Overview

Claudio provides a visual interface for managing Claude Code's native subagent system, fundamentally different from Claudia's approach:

| Aspect | Claudia | Claudio |
|--------|---------|---------|
| **Storage** | SQLite database | File-based (.md files) |
| **Agent Execution** | External process spawning | Native Claude Code Task tool |
| **Session Tracking** | Manual JSONL parsing | Claude Code native |
| **Architecture** | Custom process management | Task tool delegation |

## 📋 Key Features (Planned)

- **File-Based Agent Storage** - Agents stored as `.claude/agents/*.md` files
- **Native Task Integration** - Uses Claude Code's built-in Task tool with subagent_type
- **Visual Agent Studio** - Create and edit agents with rich UI
- **Project-Based Management** - Per-project agent libraries
- **Real-Time Execution** - Live agent task execution dashboard

## 🚧 Development Status

**Current Phase: Baseline Establishment**
- ✅ Working Claudia baseline established
- ✅ Build system and dependencies resolved
- ⏳ Metadata transformation (Claudia → Claudio)
- ⏳ SQLite to file-based storage migration
- ⏳ External process to Task tool integration

**Upcoming Phases:**
- Agent file parser implementation
- Visual agent studio interface
- Task execution dashboard
- Project integration features

## ⚡ Quick Start (Development)

### Prerequisites
- **Claude Code CLI** - Required for native Task tool integration
- **Rust 1.70.0+** - For Tauri backend
- **Node.js 18+** - For frontend development
- **npm or Bun** - Package management (both supported)

### Development Setup
```bash
git clone https://github.com/oO/Claudio.git
cd Claudio
npm install  # or: bun install
npm run tauri dev  # or: bun run tauri dev
```

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Project context and development guidelines
- **[docs/design.md](docs/design.md)** - Architecture and design decisions
- **[docs/tasks.md](docs/tasks.md)** - Development roadmap and task breakdown
- **[docs/claudia_readme.md](docs/claudia_readme.md)** - Original Claudia documentation

## 🎯 Vision

Claudio aims to be the definitive visual interface for Claude Code's agent ecosystem, providing:
- Seamless integration with Claude Code workflows
- Intuitive agent creation and management
- Visual task execution monitoring
- Community agent sharing and templates

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

Forked from [Claudia](https://github.com/getAsterisk/claudia) with gratitude to the original authors.
