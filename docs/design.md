# Claudio Design Document

## Project Overview

Claudio is a visual interface for managing Claude Code's native subagent system. Built on Tauri + React, it provides a seamless way to create, manage, and execute Claude Code agents stored as `.claude/agents/*.md` files.

## Architecture Overview

### Current State
- ✅ **Foundation**: Tauri + React + TypeScript setup complete
- ✅ **Project Structure**: Clean separation of concerns
- ✅ **Basic UI**: Welcome screen with feature previews
- ✅ **Rust Commands**: Placeholder structure for all major operations
- ✅ **Git Setup**: AGPL-3.0 licensed, proper commit format

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

### Phase 1: Dual-Level Agent Management
**Priority: HIGH** *(Updated based on Claude Code research)*

1. **Agent File Parser** (`src-tauri/src/commands/agents.rs`) ✅ *COMPLETED*
   - ✅ Parse YAML frontmatter + markdown content
   - ✅ Extract metadata: name, description, tools, model, color, icon
   - ✅ Handle malformed files gracefully with proper error messages
   - ✅ Generate properly formatted agent files

2. **Dual-Level Agent Discovery** *(Updated)*
   - ✅ `list_agents()` - Scan both user-level (`~/.claude/agents/`) and project-level (`.claude/agents/`)
   - ✅ Merge agents with project-level precedence
   - ✅ Handle agent name conflicts correctly
   - ✅ Return categorized agent lists (user vs project)

3. **Agent CRUD Operations** ✅ *COMPLETED*
   - ✅ `create_agent()` - Generate .md files with YAML frontmatter
   - ✅ `update_agent()` - Modify existing .md files
   - ✅ `delete_agent()` - Remove .md files safely
   - ✅ `get_agent()` - Load specific agent details
   - ✅ Support both user-level and project-level locations

4. **Agent Import/Export** ✅ *COMPLETED*
   - ✅ Export agents to JSON format for sharing
   - ✅ Import agents from JSON with conflict resolution
   - ✅ File-based import/export functionality

### Phase 2: Claude Code Task Tool Integration  
**Priority: HIGH** *(Updated based on research)*

1. **Native Task Tool Integration** 🚧 *IN PROGRESS*
   - 🔄 Research Claude Code's internal Task tool implementation
   - 🔄 Implement `execute_agent()` using `subagent_type` parameter
   - 🔄 Handle tool restrictions based on agent's `tools` frontmatter field
   - 🔄 Respect model preferences from agent metadata
   - 🔄 No external process spawning - use Claude Code's native agent system

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

### Phase 3: User Interface
**Priority: MEDIUM**

1. **Agent Studio Component**
   - Visual markdown editor for agents
   - Live preview of agent structure
   - Tool selection interface
   - System prompt editor with syntax highlighting

2. **Project Browser Component**
   - List Claude Code projects
   - Show agent count per project
   - Navigate to project-specific agents

3. **Task Dashboard Component**
   - Show active agent executions
   - Display real-time output/logs
   - Allow task cancellation
   - Show execution history

### Phase 4: Advanced Features
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

## Notes for Next Developer

1. **Start with `src-tauri/src/commands/agents.rs`** - The file parser is foundational
2. **Test with real `.claude/agents/*.md` files** - Create samples for testing
3. **Focus on Claude Code integration early** - This is the core differentiator
4. **Use existing Tauri patterns** - Follow the established command structure
5. **Maintain AGPL-3.0 compliance** - All derived work must remain open source

The foundation is solid. Focus on the agent file parsing first, then build up to Claude Code integration. The UI can be developed in parallel once the backend operations are working.