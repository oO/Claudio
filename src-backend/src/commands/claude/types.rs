use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::process::Child;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TodoCounts {
    /// Number of open todos (pending + in_progress)
    pub open: u32,
    /// Number of completed todos
    pub completed: u32,
    /// Total number of todos
    pub total: u32,
}

/// Global state to track current Claude process
pub struct ClaudeProcessState {
    pub current_process: Arc<Mutex<Option<Child>>>,
}

impl Default for ClaudeProcessState {
    fn default() -> Self {
        Self {
            current_process: Arc::new(Mutex::new(None)),
        }
    }
}

/// Represents a project in the ~/.claude/projects directory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    /// The project ID (derived from the directory name)
    pub id: String,
    /// The original project path (decoded from the directory name)
    pub path: String,
    /// Number of sessions (JSONL files) in this project
    pub session_count: usize,
    /// Unix timestamp when the project directory was created
    pub created_at: u64,
    /// Total size of all project files in bytes
    pub total_size_bytes: Option<u64>,
    /// Last activity timestamp (most recent session)
    pub last_active: Option<u64>,
    /// Number of local project agents in .claude/agents/
    pub agent_count: Option<u32>,
}

/// Represents a session with its metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// The session ID (UUID)
    pub id: String,
    /// The project ID this session belongs to
    pub project_id: String,
    /// The project path
    pub project_path: String,
    /// Optional todo data associated with this session  
    pub todo_data: Option<serde_json::Value>,
    /// Aggregated todo counts from all agent executions in this session
    pub todo_counts: Option<TodoCounts>,
    /// Unix timestamp when the session file was created
    pub created_at: u64,
    /// Unix timestamp when the session file was last modified
    pub modified_at: u64,
    /// First user message content (if available)
    pub first_message: Option<String>,
    /// Timestamp of the first user message (if available)
    pub message_timestamp: Option<String>,
    /// Session file size in bytes
    pub size_bytes: Option<u64>,
    /// Token count for this session
    pub token_count: Option<u64>,
    /// Estimated cost for this session in USD
    pub cost_usd: Option<f64>,
    /// Message count in this session
    pub message_count: Option<u64>,
}

/// Claude CLI session decorated with optional Claudio metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecoratedSession {
    /// The session ID (UUID)
    pub id: String,
    /// The project ID this session belongs to
    pub project_id: String,
    /// The project path
    pub project_path: String,
    /// Unix timestamp when the session file was created
    pub created_at: u64,
    /// Unix timestamp when the session file was last modified
    pub modified_at: u64,
    /// First user message content (if available)
    pub first_message: Option<String>,
    /// Session file size in bytes
    pub size_bytes: Option<u64>,
    /// Message count in this session
    pub message_count: Option<u64>,
    /// Live session type for decoration
    pub live_session_type: Option<String>,
    /// Aggregated todo counts from all agent executions in this session
    pub todo_counts: Option<TodoCounts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWithContent {
    /// Session metadata
    pub session: Session,
    /// Full path to the session file
    pub file_path: String,
    /// Parsed JSONL content
    pub content: Vec<serde_json::Value>,
}

/// Represents a message entry in the JSONL file
#[derive(Debug, Deserialize)]
struct JsonlEntry {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    entry_type: Option<String>,
    message: Option<MessageContent>,
    timestamp: Option<String>,
}

/// Represents a content block within a message
#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: Option<String>,
    text: Option<String>,
}

/// Represents the message content with array-based content format
#[derive(Debug, Deserialize)]
struct MessageContent {
    role: Option<String>,
    content: Option<serde_json::Value>, // Can be either string or array of ContentBlock
}

/// Represents the settings from ~/.claude/settings.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSettings {
    #[serde(flatten)]
    pub data: serde_json::Value,
}

impl Default for ClaudeSettings {
    fn default() -> Self {
        Self {
            data: serde_json::json!({}),
        }
    }
}

/// Represents the Claude Code version status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeVersionStatus {
    /// Whether Claude Code is installed and working
    pub is_installed: bool,
    /// The version string if available
    pub version: Option<String>,
    /// The full output from the command
    pub output: String,
}

/// Represents a CLAUDE.md file found in the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMdFile {
    /// Relative path from the project root
    pub relative_path: String,
    /// Absolute path to the file
    pub absolute_path: String,
    /// File size in bytes
    pub size: u64,
    /// Last modified timestamp
    pub modified: u64,
}

/// Represents a file or directory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// The name of the file or directory
    pub name: String,
    /// The full path
    pub path: String,
    /// Whether this is a directory
    pub is_directory: bool,
    /// File size in bytes (0 for directories)
    pub size: u64,
    /// File extension (if applicable)
    pub extension: Option<String>,
}

#[derive(Default)]
pub struct SessionAnalytics {
    pub message_count: u64,
    pub token_count: u64,
    pub cost_usd: f64,
}

/// Parse todos from a single agent todo file
pub fn parse_agent_todo_file(file_path: &PathBuf) -> Result<Vec<serde_json::Value>, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read todo file: {}", e))?;
    
    serde_json::from_str::<Vec<serde_json::Value>>(&content)
        .map_err(|e| format!("Failed to parse todo file: {}", e))
}

/// Count todos by status from a list of parsed todos
pub fn count_todos_by_status(todos: &[serde_json::Value]) -> TodoCounts {
    let mut open_count = 0u32;
    let mut completed_count = 0u32;
    let total_count = todos.len() as u32;
    
    for todo in todos {
        if let Some(status) = todo.get("status").and_then(|s| s.as_str()) {
            match status {
                "pending" | "in_progress" => open_count += 1,
                "completed" => completed_count += 1,
                _ => {} // Unknown status, don't count
            }
        }
    }
    
    TodoCounts { open: open_count, completed: completed_count, total: total_count }
}

/// Count local agents in a project's .claude/agents directory
#[allow(dead_code)]
pub fn count_project_agents(project_path: &str) -> Option<u32> {
    let agents_dir = PathBuf::from(project_path).join(".claude").join("agents");
    
    if !agents_dir.exists() {
        return None;
    }
    
    match fs::read_dir(&agents_dir) {
        Ok(entries) => {
            let count = entries
                .flatten()
                .filter(|entry| {
                    entry.path().is_file() && 
                    entry.path().extension().and_then(|s| s.to_str()) == Some("md")
                })
                .count() as u32;
            
            if count > 0 { Some(count) } else { None }
        }
        Err(_) => None,
    }
}

/// Aggregate todo counts from all agent executions for a session
pub fn aggregate_session_todos(claude_dir: &PathBuf, session_id: &str) -> Option<TodoCounts> {
    let todos_dir = claude_dir.join("todos");
    let pattern = format!("{}-agent-", session_id);
    
    let mut all_todos = Vec::new();
    
    // Find all agent todo files for this session
    if let Ok(entries) = fs::read_dir(&todos_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            
            // Check if this is an agent todo file for our session
            if file_name.starts_with(&pattern) && file_name.ends_with(".json") {
                if let Ok(todos) = parse_agent_todo_file(&entry.path()) {
                    all_todos.extend(todos);
                }
            }
        }
    }
    
    if !all_todos.is_empty() {
        Some(count_todos_by_status(&all_todos))
    } else {
        None
    }
}

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
pub fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    crate::claude_binary::find_claude_binary(app_handle)
}

/// Gets the path to the ~/.claude directory
pub fn get_claude_dir() -> Result<PathBuf, anyhow::Error> {
    let claude_dir = dirs::home_dir()
        .context("Could not find home directory")?
        .join(".claude");
    
    // Create the directory if it doesn't exist
    if !claude_dir.exists() {
        std::fs::create_dir_all(&claude_dir)
            .context("Failed to create ~/.claude directory")?;
    }
    
    Ok(claude_dir)
}

pub fn get_project_path_from_sessions(project_dir: &PathBuf) -> Result<String, String> {
    // log::info!("🔍 Trying to determine project path from sessions in directory: {:?}", project_dir);
    // Try to read any JSONL file in the directory
    let entries = fs::read_dir(project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                // log::info!("📁 Found JSONL file to check: {:?}", path);
                // Read the first line of the JSONL file
                if let Ok(file) = fs::File::open(&path) {
                    let reader = BufReader::new(file);
                    if let Some(Ok(first_line)) = reader.lines().next() {
                        // log::info!("📄 Session file content (first line): {}", first_line);
                        // Parse the JSON and extract cwd
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&first_line) {
                            // log::info!("✅ Successfully parsed JSON from session file");
                            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                                // log::info!("🎯 Found cwd in session file: {}", cwd);
                                return Ok(cwd.to_string());
                            } else {
                                log::warn!("⚠️ No 'cwd' field found in session file JSON");
                            }
                        } else {
                            log::error!("❌ Failed to parse JSON from session file first line");
                        }
                    } else {
                        log::warn!("📝 Session file exists but has no content or failed to read first line: {:?}", path);
                    }
                } else {
                    log::error!("🚫 Failed to open session file: {:?}", path);
                }
            }
        }
    }

    Err("Could not determine project path from session files".to_string())
}

pub fn decode_project_path(encoded: &str) -> String {
    // This is a fallback - the encoding isn't reversible when paths contain hyphens
    // For example: -Users-mufeedvh-dev-jsonl-viewer could be /Users/mufeedvh/dev/jsonl-viewer
    // or /Users/mufeedvh/dev/jsonl/viewer
    encoded.replace('-', "/")
}

/// Extracts text content from a message content value (handles both string and array formats)
fn extract_text_from_content(content: &serde_json::Value) -> Option<String> {
    match content {
        // Handle legacy string format
        serde_json::Value::String(s) => Some(s.clone()),
        // Handle array format with content blocks
        serde_json::Value::Array(blocks) => {
            // Look for the first text block
            for block in blocks {
                if let Ok(content_block) = serde_json::from_value::<ContentBlock>(block.clone()) {
                    if content_block.content_type.as_deref() == Some("text") {
                        if let Some(text) = content_block.text {
                            return Some(text);
                        }
                    }
                }
            }
            None
        }
        _ => None,
    }
}

/// Extracts the first meaningful user message from a JSONL file
/// Prefers messages with 8+ words, but falls back to the longest message found (up to 5 messages scanned)
pub fn extract_first_user_message(jsonl_path: &PathBuf) -> (Option<String>, Option<String>) {
    let file = match fs::File::open(jsonl_path) {
        Ok(file) => file,
        Err(_) => return (None, None),
    };

    let reader = BufReader::new(file);
    
    let mut longest_message: Option<String> = None;
    let mut longest_timestamp: Option<String> = None;
    let mut longest_word_count = 0;
    let mut messages_checked = 0;
    const MAX_MESSAGES_TO_CHECK: usize = 5;
    const MIN_WORDS_FOR_GOOD_TITLE: usize = 8;

    for line in reader.lines() {
        if let Ok(line) = line {
            if let Ok(entry) = serde_json::from_str::<JsonlEntry>(&line) {
                if let Some(message) = entry.message {
                    if message.role.as_deref() == Some("user") {
                        if let Some(content) = message.content {
                            // Extract text from content (handles both string and array formats)
                            if let Some(text_content) = extract_text_from_content(&content) {
                                // Skip if it contains the caveat message
                                if text_content.contains("Caveat: The messages below were generated by the user while running local commands") {
                                    continue;
                                }

                                // Skip if it starts with command tags
                                if text_content.starts_with("<command-name>")
                                    || text_content.starts_with("<local-command-stdout>")
                                {
                                    continue;
                                }

                                // Count words in the message
                                let word_count = text_content.split_whitespace().count();
                                
                                // If this message has enough words, use it immediately
                                if word_count >= MIN_WORDS_FOR_GOOD_TITLE {
                                    return (Some(text_content), entry.timestamp);
                                }
                                
                                // Otherwise, track it if it's the longest so far
                                if word_count > longest_word_count {
                                    longest_message = Some(text_content);
                                    longest_timestamp = entry.timestamp.clone();
                                    longest_word_count = word_count;
                                }
                                
                                messages_checked += 1;
                                if messages_checked >= MAX_MESSAGES_TO_CHECK {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Return the longest message we found (even if it's shorter than ideal)
    (longest_message, longest_timestamp)
}

/// Helper function to create a tokio Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> tokio::process::Command {
    // Convert std::process::Command to tokio::process::Command
    let _std_cmd = crate::claude_binary::create_command_with_env(program);

    // Create a new tokio Command from the program path
    let mut tokio_cmd = tokio::process::Command::new(program);

    // Copy over all environment variables
    for (key, value) in std::env::vars() {
        if key == "PATH"
            || key == "HOME"
            || key == "USER"
            || key == "SHELL"
            || key == "LANG"
            || key == "LC_ALL"
            || key.starts_with("LC_")
            || key == "NODE_PATH"
            || key == "NVM_DIR"
            || key == "NVM_BIN"
            || key == "HOMEBREW_PREFIX"
            || key == "HOMEBREW_CELLAR"
        {
            log::debug!("Inheriting env var: {}={}", key, value);
            tokio_cmd.env(&key, &value);
        }
    }

    // Add NVM support if the program is in an NVM directory
    if program.contains("/.nvm/versions/node/") {
        if let Some(node_bin_dir) = std::path::Path::new(program).parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let node_bin_str = node_bin_dir.to_string_lossy();
            if !current_path.contains(&node_bin_str.as_ref()) {
                let new_path = format!("{}:{}", node_bin_str, current_path);
                tokio_cmd.env("PATH", new_path);
            }
        }
    }

    tokio_cmd
}

/// Creates a system binary command with the given arguments
pub fn create_system_command(
    claude_path: &str,
    args: Vec<String>,
    project_path: &str,
) -> tokio::process::Command {
    let mut cmd = create_command_with_env(claude_path);
    
    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }
    
    cmd.current_dir(project_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    cmd
}

pub fn calculate_directory_size(dir: &PathBuf) -> Result<u64, String> {
    let mut total_size = 0u64;
    
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            if let Ok(metadata) = fs::metadata(&path) {
                total_size += metadata.len();
            }
        } else if path.is_dir() {
            match calculate_directory_size(&path) {
                Ok(size) => total_size += size,
                Err(_) => continue, // Skip directories we can't read
            }
        }
    }
    
    Ok(total_size)
}

pub fn parse_session_analytics(file_path: &PathBuf) -> SessionAnalytics {
    let mut analytics = SessionAnalytics::default();
    
    let file = match fs::File::open(file_path) {
        Ok(f) => f,
        Err(_) => return analytics,
    };
    
    let reader = BufReader::new(file);
    
    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        
        if line.trim().is_empty() {
            continue;
        }
        
        // Parse JSON line
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
            analytics.message_count += 1;
            
            // Look for usage information in various places
            if let Some(usage) = json.get("usage") {
                if let Some(input_tokens) = usage.get("input_tokens").and_then(|v| v.as_u64()) {
                    analytics.token_count += input_tokens;
                }
                if let Some(output_tokens) = usage.get("output_tokens").and_then(|v| v.as_u64()) {
                    analytics.token_count += output_tokens;
                }
            }
            
            // Also check message.usage
            if let Some(message) = json.get("message") {
                if let Some(usage) = message.get("usage") {
                    if let Some(input_tokens) = usage.get("input_tokens").and_then(|v| v.as_u64()) {
                        analytics.token_count += input_tokens;
                    }
                    if let Some(output_tokens) = usage.get("output_tokens").and_then(|v| v.as_u64()) {
                        analytics.token_count += output_tokens;
                    }
                }
            }
            
            // Look for cost information
            if let Some(cost) = json.get("cost").and_then(|v| v.as_f64()) {
                analytics.cost_usd += cost;
            }
        }
    }
    
    analytics
}

