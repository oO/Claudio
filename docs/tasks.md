# Claudio Development Tasks

## Current Status
✅ **Project Foundation Complete** - Tauri + React setup, git repository, basic structure
✅ **Project & Session Management Complete** - Delete functionality, storage analytics, UI enhancements

## ⚠️ **IMPORTANT DESIGN ISSUES TO REVISIT**

### **Cost Calculation Limitations**
**Status:** TEMPORARILY DISABLED
**Issue:** Claude Code is available as part of different subscriptions (Pro, Max 1, Max 2) which don't spend API tokens. Current cost calculations are misleading/irrelevant for most users.

**TODO:**
- Research how to detect subscription vs API usage
- Implement proper cost display logic (show only for API users)
- Consider showing "subscription included" for Pro/Max users
- Review backend cost parsing in `parse_session_analytics()`

## Next Development Tasks (Priority Order)

### 🔥 **IMMEDIATE - Start Here**

#### 1. **✅ COMPLETED - Agent File Parser** 
**File:** `src-tauri/src/commands/agents.rs`
**Status:** FULLY IMPLEMENTED

**What was implemented:**
- ✅ `AgentParser` struct with `parse_file()` and `generate_markdown()` methods
- ✅ YAML frontmatter parsing with special character handling
- ✅ Extraction of: name, description, tools, model, color (no icon per Claude Code spec)
- ✅ Robust error handling for malformed files
- ✅ Proper markdown generation with ordered YAML fields

#### 2. **Implement list_agents() Function**
**File:** `src-tauri/src/commands/agents.rs`  
**Priority:** CRITICAL

```rust
#[tauri::command]
pub async fn list_agents(project_path: String) -> Result<Vec<Agent>, String> {
    // 1. Build path to .claude/agents/
    // 2. Read directory contents
    // 3. Filter for .md files
    // 4. Parse each file using AgentParser
    // 5. Return Vec<Agent> with metadata
}
```

**Acceptance Criteria:**
- Scan `.claude/agents/*.md` files recursively
- Return complete Agent metadata
- Handle missing directories gracefully
- Include file timestamps (created_at, updated_at)

#### 3. **Create Basic Agent Studio UI**
**File:** `src/components/AgentStudio.tsx`
**Priority:** HIGH

```tsx
interface AgentStudioProps {
  projectPath: string;
  agentName?: string; // For editing existing agent
}

export function AgentStudio({ projectPath, agentName }: AgentStudioProps) {
  // Form fields for:
  // - Agent name
  // - Description
  // - Tool selection (checkboxes)
  // - System prompt (textarea)
  // - Live markdown preview
}
```

**Acceptance Criteria:**
- Form validation for required fields
- Tool selection with predefined options
- Live preview of generated markdown
- Save/cancel functionality

### 🔥 **HIGH PRIORITY - Week 1**

#### 4. **Implement create_agent() Function**
**File:** `src-tauri/src/commands/agents.rs`
**Priority:** HIGH

```rust
#[tauri::command]
pub async fn create_agent(
    project_path: String,
    agent_data: AgentData,
) -> Result<Agent, String> {
    // 1. Validate agent name (no special chars, .md extension)
    // 2. Create .claude/agents/ directory if needed
    // 3. Generate markdown using AgentParser
    // 4. Write file with error handling
    // 5. Return created Agent metadata
}
```

#### 5. **Project Discovery Implementation**
**File:** `src-tauri/src/commands/claude_integration.rs`
**Priority:** HIGH

```rust
#[tauri::command]
pub async fn get_claude_projects() -> Result<Vec<ClaudeProject>, String> {
    // Scan common directories for .claude/ folders:
    // - ~/Projects/
    // - ~/Development/
    // - ~/Code/
    // - Current working directory
}
```

#### 6. **Research Claude Code Integration** 
**Research Task**
**Priority:** HIGH

**Investigation Areas:**
- Claude Code SDK availability
- Task tool CLI interface  
- Subagent execution methods
- Error handling patterns
- Output capturing techniques

**Deliverable:** Create `CLAUDE_INTEGRATION.md` with findings

### 🆕 **CRITICAL NEW FEATURE - Project & Session Management**
**Rationale:** Claude Code CLI has NO built-in project/session management commands

#### 7. **Implement Project Discovery & Listing**
**File:** `src-tauri/src/commands/projects.rs` (new)
**Priority:** CRITICAL

```rust
#[tauri::command]
pub async fn list_claude_projects() -> Result<Vec<ClaudeProject>, String> {
    // 1. Scan ~/.claude/projects/ for encoded directories
    // 2. Decode paths: -Users-olivier-Projects-app → /Users/olivier/Projects/app
    // 3. Count sessions and calculate sizes
    // 4. Check for CLAUDE.md and .mcp.json
}
```

#### 8. **Implement Session Management**
**File:** `src-tauri/src/commands/sessions.rs` (new)
**Priority:** CRITICAL

```rust
#[tauri::command]
pub async fn list_project_sessions(project_path: String) -> Result<Vec<ClaudeSession>, String> {
    // Parse JSONL files for metadata
}

#[tauri::command]
pub async fn delete_session(project_path: String, session_id: String) -> Result<(), String> {
    // Delete specific session file
}

#[tauri::command]
pub async fn prune_old_sessions(days_old: u32) -> Result<PruneResult, String> {
    // Bulk cleanup old sessions
}
```

#### 9. **Create Project Manager UI**
**File:** `src/components/ProjectManager.tsx`
**Priority:** HIGH

```tsx
export function ProjectManager() {
  // List all Claude projects with metadata
  // Delete projects, view sessions
  // Show storage usage and costs
}
```

#### 10. **Create Session Manager UI**
**File:** `src/components/SessionManager.tsx`
**Priority:** HIGH

```tsx
export function SessionManager({ project }: Props) {
  // List project sessions
  // Delete, export, view sessions
  // Filter by date/size/cost
}
```

### 📋 **HIGH PRIORITY - Complete Agent System**

#### 11. **Enable Project-Level Agent Discovery**
**File:** `src-tauri/src/commands/agents.rs`
- Modify to scan both ~/.claude/agents/ and <project>/.claude/agents/
- Implement precedence rules

#### 12. **Implement Task Tool Integration**
**File:** `src-tauri/src/commands/agents.rs::execute_agent()`
**Priority:** CRITICAL - BLOCKS AGENT EXECUTION

#### 13. **Agent Run Tracking**
**File:** `src-tauri/src/commands/agents.rs`
- Implement file-based run storage
- Track execution history

### 🔧 **LOWER PRIORITY - Week 3+**

#### 11. **Task Dashboard UI**
**File:** `src/components/TaskDashboard.tsx`

#### 12. **Agent Import/Export**
**Files:** Multiple

#### 13. **Error Handling & Polish**
**Files:** Various

## Development Guidelines

### **File Naming Conventions**
- Agent files: `kebab-case-name.md`
- React components: `PascalCase.tsx`
- Rust modules: `snake_case.rs`

### **Testing Strategy**
- Create sample `.claude/agents/*.md` files for testing
- Test with both valid and malformed agent files
- Verify cross-platform file path handling

### **Error Handling Requirements**
- All Rust functions return `Result<T, String>`
- Provide user-friendly error messages
- Log detailed errors for debugging
- Handle edge cases gracefully

### **UI/UX Principles**
- Follow existing Tauri app patterns
- Use Tailwind CSS for consistent styling
- Provide immediate feedback for user actions
- Keep interfaces clean and intuitive

## Sample Agent Files for Testing

Create these in `.claude/agents/` for testing:

**`.claude/agents/code-reviewer.md`:**
```markdown
# Code Reviewer

Reviews code changes for best practices, security, and performance issues.

## Tools
- Read
- Grep
- Bash

## System Prompt
You are a senior code reviewer focused on quality and security.
Review code changes and provide constructive feedback.
Always check for common security vulnerabilities.
```

**`.claude/agents/documentation-writer.md`:**
```markdown
# Documentation Writer

Creates and maintains technical documentation.

## Tools  
- Read
- Write
- Glob

## System Prompt
You are a technical writer who creates clear, comprehensive documentation.
Focus on user-friendly explanations and practical examples.
```

## Git Workflow

**Commit Message Format:**
```
type: brief description (vX.X.X)

- Bullet point describing change 1
- Bullet point describing change 2

Designed with ❤️ by oO. Coded with ✨ by Claude Sonnet 4
Co-authored-by: Claude.AI <noreply@anthropic.com>
```

**Types:** `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

## Ready to Continue?

### 🚨 **Two Critical Features Missing**

1. **Task Tool Integration** - Agents can't execute without this
   - File: `src-tauri/src/commands/agents.rs::execute_agent()`
   - Use CLI approach with `claude_binary::find_claude_binary()`
   - This unblocks the entire agent execution system

2. **Project/Session Management** - Major gap in Claude Code
   - Files: `projects.rs` and `sessions.rs` (new)
   - Claude Code has NO CLI commands for this
   - Users need visual tools to manage ~/.claude/projects/

### 🎯 **Quick Start**

1. **Run the app:** `npm install && npm run tauri:dev`
2. **Test current features:** Agent CRUD works perfectly
3. **Pick a critical feature:** Task integration or Project management
4. **Reference docs:** 
   - `docs/design.md` - Architecture details
   - `docs/project-session-management.md` - New feature design

The foundation is solid - these two features will make Claudio indispensable! 🚀