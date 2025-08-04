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
└── Storage
    ├── .claude/agents/*.md (Agent definitions)
    ├── .claude/settings.json (Project config)
    └── No database (file-based only)
```

## Agent File Format Specification

### Standard Agent .md Structure
```markdown
# Agent Name

Brief description of when to use this agent.

## Tools
- Read
- Write  
- Bash
- Grep

## System Prompt
You are a specialized agent for [specific task].
Your role is to [specific instructions].

Always [specific guidelines].

## Examples
Optional examples of usage patterns.
```

### Metadata Extraction
- **Name**: First H1 heading
- **Description**: First paragraph after title
- **Tools**: Bullet list under "## Tools" section
- **System Prompt**: Content under "## System Prompt" section

## Implementation Plan

### Phase 1: File-Based Agent Management
**Priority: HIGH**

1. **Agent File Parser** (`src-tauri/src/commands/agents.rs`)
   - Parse `.md` files to extract agent metadata
   - Validate agent file format
   - Handle malformed files gracefully

2. **Agent CRUD Operations**
   - `list_agents()` - Scan `.claude/agents/*.md` files
   - `create_agent()` - Generate .md from AgentData
   - `update_agent()` - Modify existing .md files
   - `delete_agent()` - Remove .md files
   - `get_agent()` - Load specific agent details

3. **Project Discovery** (`src-tauri/src/commands/claude_integration.rs`)
   - Scan filesystem for `.claude/` directories
   - Identify Claude Code projects
   - Count agents per project

### Phase 2: Claude Code Integration  
**Priority: HIGH**

1. **Task Tool Integration**
   - Research Claude Code SDK/API
   - Implement native Task tool execution
   - Handle subagent_type parameter correctly
   - Capture execution results and errors

2. **Agent Execution Flow**
   ```rust
   // Simplified execution flow
   async fn execute_agent_task(
       project_path: String,
       agent_name: String, 
       task_description: String
   ) -> Result<TaskResult> {
       // 1. Validate agent exists
       // 2. Call Claude Code Task tool with subagent_type
       // 3. Monitor execution status
       // 4. Return results/errors
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