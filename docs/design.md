# Claudio Design Document

## Project Overview

Claudio is a visual interface for managing Claude Code's native subagent system. Built on Tauri + React, it provides a seamless way to create, manage, and execute Claude Code agents stored as `.claude/agents/*.md` files.

## Architecture Overview

### Current State (v0.2.2)
- ✅ **Foundation**: Tauri + React + TypeScript setup complete
- ✅ **Project Structure**: Clean separation of concerns  
- ✅ **Basic UI**: Welcome screen with feature previews
- ✅ **Rust Commands**: Fully implemented agent CRUD operations
- ✅ **Git Setup**: AGPL-3.0 licensed, proper commit format
- ✅ **Agent Parser**: Complete YAML frontmatter parser with error handling
- ✅ **File-Based Storage**: Migrated from SQLite to .claude/agents/*.md files
- ✅ **Dual-Level Discovery**: Support for both user-level and project-level agents
- ✅ **Import/Export**: JSON and file-based agent sharing functionality
- ✅ **UI Components**: CreateAgent, AgentsModal, AgentExecution views
- ✅ **Analytics**: PostHog integration for usage tracking
- ✅ **CI/CD**: Multi-platform GitHub Actions workflows

### Target Architecture

```
Claudio Desktop App
├── Frontend (React/TypeScript)
│   ├── Agent Studio (Visual .md editor)
│   ├── Project Browser (Claude Code projects)
│   ├── Task Dashboard (Active executions)
│   └── Agent Library (Browse/Import agents)
│
├── Backend (Rust/Tauri)
│   ├── File System Operations (.claude/agents/*.md)
│   ├── Claude Code Integration (Task tool + SDK)
│   ├── Project Discovery (Scan for .claude dirs)
│   └── Agent Execution (Native subagent delegation)
│
└── Storage (Dual-Level Agent Discovery)
    ├── ~/.claude/agents/*.md (User-level agents - global)
    ├── <project>/.claude/agents/*.md (Project-level agents)
    ├── .claude/settings.json (Project config)
    └── No database (file-based only, native Claude Code integration)
```

## Agent File Format Specification

**UPDATED**: Based on research of Claude Code's native agent system, the actual format uses YAML frontmatter, not markdown headers.

### Actual Claude Code Agent Format
```markdown
---
name: agent-name
description: Brief description of when to use this agent with usage examples
tools: Task, Bash, Edit, MultiEdit, Write, Read, Grep, LS, etc.
model: inherit|sonnet|opus|haiku
color: blue|green|purple|red|yellow|etc.
icon: 👩‍💻 (optional emoji)
---

System prompt content here...

You are a specialized agent for [specific task].
Your role is to [specific instructions].

Always [specific guidelines].
```

### Metadata Extraction (Updated)
- **Name**: `name` field in YAML frontmatter (kebab-case)
- **Description**: `description` field in YAML frontmatter (includes usage examples)
- **Tools**: `tools` field - comma-separated list of Claude Code tools
- **Model**: `model` field - inherit, sonnet, opus, haiku, etc.
- **Color**: `color` field - UI color theme for the agent
- **Icon**: `icon` field - optional emoji icon
- **System Prompt**: All content after the YAML frontmatter delimiter

## Claude Code Agent Discovery System

**CRITICAL**: Based on research, Claude Code uses a dual-level agent discovery system that Claudio must respect:

### User-Level Agents (`~/.claude/agents/*.md`)
- **Global agents** available across all projects
- Stored in user's home directory: `~/.claude/agents/`
- Examples: `architecture-designer.md`, `software-engineer.md`, etc.
- Shared across all Claude Code projects

### Project-Level Agents (`<project>/.claude/agents/*.md`)
- **Project-specific agents** for local use
- Stored in each project's `.claude/agents/` directory
- Can override user-level agents with same name
- Project-specific customizations and workflows

### Agent Resolution Priority
1. Project-level agents take precedence over user-level agents
2. Agent names must be unique within each level
3. Claude Code automatically discovers and merges both levels
4. Claudio must implement same discovery logic for consistency

### Integration with Claude Code Task Tool
- Agents are invoked via `subagent_type: "agent-name"` parameter
- Tool lists in frontmatter determine available tools for that agent
- Model preference from frontmatter is respected
- No external process spawning - native Claude Code integration

## Implementation Plan

### Phase 1: Dual-Level Agent Management ✅ **COMPLETED**
**Priority: HIGH** *(Updated based on Claude Code research)*

1. **Agent File Parser** (`src-tauri/src/commands/agents.rs`) ✅ *COMPLETED*
   - ✅ Parse YAML frontmatter + markdown content
   - ✅ Extract metadata: name, description, tools, model, color, ~~icon~~
   - ✅ Handle malformed files gracefully with proper error messages
   - ✅ Generate properly formatted agent files
   - ✅ Special handling for unquoted YAML special characters

2. **Dual-Level Agent Discovery** ✅ *COMPLETED*
   - ✅ `list_agents()` - Currently scans user-level (`~/.claude/agents/`)
   - ⚠️ Project-level scanning ready but not yet enabled (uses global only)
   - ✅ File metadata extraction for timestamps
   - ✅ Sorted agent lists with temporary ID assignment

3. **Agent CRUD Operations** ✅ *COMPLETED*
   - ✅ `create_agent()` - Generate .md files with YAML frontmatter
   - ✅ `update_agent()` - Modify existing .md files preserving creation time
   - ✅ `delete_agent()` - Remove .md files safely
   - ✅ `get_agent()` - Load specific agent details with metadata
   - ✅ Safe filename generation from agent names

4. **Agent Import/Export** ✅ *COMPLETED*
   - ✅ Export agents to JSON format for sharing
   - ✅ Import agents from JSON with automatic renaming on conflicts
   - ✅ Direct .md file export functionality
   - ⚠️ GitHub import placeholder (not yet implemented)

### Phase 2: Claude Code Task Tool Integration  
**Priority: HIGH** *(Next major milestone)*

1. **Native Task Tool Integration** 🔄 *READY TO IMPLEMENT*
   - ⚠️ `execute_agent()` function exists but returns placeholder error
   - 📝 Research needed: How to invoke Claude Code's Task tool from Rust
   - 📝 Consider using `claude_binary::find_claude_binary()` for CLI approach
   - 📝 Implement proper `subagent_type` parameter passing
   - 📝 Stream output capture and real-time updates

2. **Agent Validation & Tool Management**
   - 🔄 Validate tool lists against Claude Code's available tools
   - 🔄 Implement tool compatibility checking
   - 🔄 Handle model selection (inherit, sonnet, opus, haiku)
   - 🔄 Validate agent names for Task tool compatibility

3. **Enhanced Agent Execution Flow** *(Updated)*
   ```rust
   // Native Claude Code integration
   async fn execute_agent_task(
       project_path: String,
       agent_name: String, 
       task_description: String
   ) -> Result<TaskResult> {
       // 1. Discover agent from dual-level system
       // 2. Validate agent tools and model
       // 3. Use Claude Code Task tool with subagent_type: agent_name
       // 4. Maintain session context and conversation history
       // 5. Return results through Claude Code's native system
   }
   ```

### Phase 3: User Interface ✅ **MOSTLY COMPLETE**
**Priority: MEDIUM**

1. **Agent Creation/Editing** ✅ *COMPLETED*
   - ✅ `CreateAgent.tsx` - Full agent creation form
   - ✅ `AgentsModal.tsx` - Agent management interface
   - ✅ Tool selection with predefined Claude Code tools
   - ✅ Model selection (sonnet, opus, haiku, inherit)
   - ✅ Color selection for agent UI themes
   - ⚠️ Live markdown preview not yet implemented

2. **Project Browser** ⚠️ *PARTIAL*
   - ✅ `ProjectList.tsx` exists for project discovery
   - ⚠️ Agent count per project not yet shown
   - ⚠️ Project-specific agent navigation not implemented

3. **Execution Components** ✅ *UI COMPLETE*
   - ✅ `AgentExecution.tsx` - Execution interface ready
   - ✅ `AgentExecutionDemo.tsx` - Demo mode for testing
   - ✅ `AgentRunView.tsx` - View past runs
   - ✅ `AgentRunOutputViewer.tsx` - JSONL output display
   - ✅ Real-time streaming message components
   - ⚠️ Waiting for backend Task tool integration

### Phase 4: Project & Session Management 🆕
**Priority: HIGH** *(Critical gap in Claude Code CLI)*

1. **Project Management**
   - List all Claude projects from `~/.claude/projects/`
   - Decode directory names back to original paths
   - Show session counts, sizes, last activity
   - Delete project metadata safely
   - Check for CLAUDE.md and .mcp.json files

2. **Session Management**  
   - List sessions per project with metadata
   - Parse JSONL for tokens, costs, timestamps
   - Delete individual sessions
   - Prune old sessions with configurable rules
   - Export sessions to JSON/Markdown/HTML

3. **Storage Analytics**
   - Total storage usage across projects
   - Cost breakdown by model and time
   - Project activity visualization
   - Session search functionality
   - Automated cleanup policies

### Phase 5: Advanced Features
**Priority: LOW**

1. **Agent Library**
   - Browse community agents
   - Import/export agent collections
   - Agent templates and scaffolding

2. **Analytics & Insights**
   - Agent usage statistics  
   - Performance metrics
   - Delegation patterns

## Technical Considerations

### Project Path Encoding

Claude Code encodes project paths for storage by replacing `/` with `-`:
```rust
// Encoding: /Users/olivier/Projects/myapp → -Users-olivier-Projects-myapp
fn encode_project_path(path: &str) -> String {
    path.replace('/', "-")
}

// Decoding: -Users-olivier-Projects-myapp → /Users/olivier/Projects/myapp  
fn decode_project_path(encoded: &str) -> String {
    encoded.replace('-', "/")
}
```

### JSONL Session Format

Sessions are stored as newline-delimited JSON:
```json
{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2025-06-02T18:46:59.937Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}]},"timestamp":"2025-06-02T18:47:06.267Z"}
```

### Claude Code Integration Methods

**Option A: CLI Invocation** (Easier)
```rust
// Execute claude command with specific agent
Command::new("claude")
    .args(["-p", task, "--subagent-type", agent_name])
    .current_dir(project_path)
    .output()
```

**Option B: SDK Integration** (Better)
```rust
// Use official Claude Code SDK (if available)
use claude_code_sdk::Task;

Task::new()
    .with_subagent(agent_name)
    .with_description(task)
    .execute_in_project(project_path)
```

### File System Operations

**Security Considerations:**
- Restrict file operations to `.claude/` directories
- Validate file paths to prevent directory traversal
- Sanitize agent names for safe filenames

**Performance:**
- Cache agent metadata to avoid re-parsing
- Watch filesystem for changes
- Debounce file system events

### Error Handling

**File Operations:**
- Handle missing `.claude/` directories
- Graceful handling of malformed .md files
- Permission errors (read-only filesystems)

**Claude Code Integration:**
- Claude binary not found
- Project not initialized
- Agent execution failures

## Development Tasks

### Immediate Next Steps (Priority Order)

1. **[HIGH] Implement Agent File Parser**
   - File: `src-tauri/src/commands/agents.rs`
   - Parse markdown to extract metadata
   - Create `AgentParser` struct with methods
   - Add comprehensive error handling

2. **[HIGH] Implement list_agents() Function**
   - Scan `.claude/agents/*.md` files recursively
   - Parse each file for metadata
   - Return Vec<Agent> with complete information
   - Handle directory not found gracefully

3. **[HIGH] Create Agent Studio UI Component**
   - File: `src/components/AgentStudio.tsx`
   - Visual markdown editor with preview
   - Tool selection checkboxes
   - Form validation and submission

4. **[HIGH] Implement create_agent() Function**
   - Generate markdown from AgentData
   - Create `.claude/agents/` directory if needed
   - Write formatted .md file
   - Return created Agent metadata

5. **[MEDIUM] Add Project Discovery**
   - Implement `get_claude_projects()`
   - Scan common project directories
   - Identify `.claude/` directories
   - Count agents per project

6. **[MEDIUM] Research Claude Code Integration**
   - Investigate Claude Code SDK/API
   - Test Task tool invocation methods
   - Document integration approach
   - Implement basic execution flow

7. **[LOW] Create Project Browser UI**
   - List discovered Claude projects
   - Show agent counts and status
   - Navigate to project-specific views

8. **[LOW] Implement Remaining CRUD Operations**
   - `update_agent()` - Modify existing files
   - `delete_agent()` - Remove files safely
   - `get_agent()` - Load specific agent

### File Structure for Implementation

```
src-tauri/src/
├── commands/
│   ├── agents.rs          # ← START HERE (agent CRUD)
│   ├── claude_integration.rs # ← Task tool integration
│   └── filesystem.rs      # ← File operations
│
src/components/
├── AgentStudio.tsx        # ← Visual agent editor
├── ProjectBrowser.tsx     # ← Project discovery UI
├── TaskDashboard.tsx      # ← Execution monitoring
└── AgentLibrary.tsx       # ← Browse/import agents
```

## Success Criteria

### MVP (Minimum Viable Product)
- ✅ List agents from `.claude/agents/*.md` files
- ✅ Create new agents with visual editor
- ✅ Execute agents using Claude Code Task tool
- ✅ Display execution results

### Full Feature Set
- ✅ Complete agent CRUD operations
- ✅ Project discovery and navigation
- ✅ Real-time execution monitoring
- ✅ Agent import/export functionality
- ✅ Community agent library integration

## Implementation Status Summary

### ✅ Completed (v0.2.2)
- **Agent File Management**: Full CRUD operations with YAML frontmatter
- **File-Based Storage**: Complete migration from SQLite to .md files
- **Import/Export**: JSON and direct file export functionality
- **UI Foundation**: Agent creation, listing, and execution interfaces
- **Analytics**: PostHog integration for usage tracking
- **CI/CD**: Multi-platform builds via GitHub Actions

### 🔄 In Progress / Next Steps
- **Task Tool Integration**: Connect to Claude Code's native agent system
- **Project & Session Management**: Fill critical gap in Claude Code CLI
- **Project-Level Agents**: Enable dual-level discovery (currently global only)
- **Live Execution**: Stream real-time output from agent runs
- **Storage Analytics**: Usage insights and cleanup tools
- **GitHub Import**: Fetch agents from GitHub repositories

### 📝 Technical Debt
- Several functions return placeholder errors (execute_agent, stream output, etc.)
- Agent run tracking still references SQLite (needs file-based approach)
- Project-level agent discovery coded but not enabled

## Critical Next Step: Task Tool Integration

The highest priority is implementing `execute_agent()` to actually run agents via Claude Code's Task tool. Two approaches:

1. **CLI Approach** (Recommended to start):
   ```rust
   Command::new(claude_binary_path)
       .args(["--task", &task_description, "--subagent-type", &agent_name])
       .current_dir(&project_path)
       .spawn()
   ```

2. **SDK Approach** (If available):
   - Research if Claude Code exposes an SDK or API
   - More robust but may not exist yet

The UI is ready and waiting - once Task tool integration works, Claudio becomes fully functional.