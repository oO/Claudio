use anyhow::Result;
use chrono;
use dirs;
use log::{info, warn};
// use reqwest; // TODO: Re-enable when GitHub agent fetching is implemented
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use rusqlite::{params, Connection, Result as SqliteResult};

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String, String> {
    crate::claude_binary::find_claude_binary(app_handle)
}

/// Represents a CC Agent stored as a file
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: Option<i64>, // For compatibility - not used in file-based storage
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: String,
    pub enable_file_read: bool,
    pub enable_file_write: bool,
    pub enable_network: bool,
    pub hooks: Option<String>, // JSON string of hooks configuration
    pub created_at: String,
    pub updated_at: String,
    pub description: Option<String>, // Agent description from frontmatter
    pub tools: Option<String>,       // Comma-separated list of tools
    pub color: Option<String>,       // Agent color for UI
}

/// Agent metadata from YAML frontmatter
#[derive(Debug, Serialize, Deserialize, Clone)]
struct AgentFrontmatter {
    pub name: String,
    pub description: Option<String>,
    pub tools: Option<String>,
    pub model: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

/// Represents an agent execution run
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRun {
    pub id: Option<i64>,
    pub agent_id: i64,
    pub agent_name: String,
    pub agent_icon: String,
    pub task: String,
    pub model: String,
    pub project_path: String,
    pub session_id: String, // UUID session ID from Claude Code
    pub status: String,     // 'pending', 'running', 'completed', 'failed', 'cancelled'
    pub pid: Option<u32>,
    pub process_started_at: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

/// Represents runtime metrics calculated from JSONL
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRunMetrics {
    pub duration_ms: Option<i64>,
    pub total_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
    pub message_count: Option<i64>,
}

/// Combined agent run with real-time metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRunWithMetrics {
    #[serde(flatten)]
    pub run: AgentRun,
    pub metrics: Option<AgentRunMetrics>,
    pub output: Option<String>, // Real-time JSONL content
}

/// Agent export format
#[derive(Debug, Serialize, Deserialize)]
pub struct AgentExport {
    pub version: u32,
    pub exported_at: String,
    pub agent: AgentData,
}

/// Agent data within export
#[derive(Debug, Serialize, Deserialize)]
pub struct AgentData {
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub default_task: Option<String>,
    pub model: String,
    pub hooks: Option<String>,
    pub description: Option<String>,
    pub tools: Option<String>,
    pub color: Option<String>,
}

/// Agent file parser for markdown-based agent definitions
pub struct AgentParser;

impl AgentParser {
    /// Preprocess YAML content to handle unquoted special characters
    fn preprocess_yaml(yaml_content: &str) -> String {
        let lines: Vec<&str> = yaml_content.lines().collect();
        let mut fixed_lines = Vec::new();
        
        for line in lines {
            let trimmed = line.trim();
            
            // Handle description field with unquoted special characters
            if trimmed.starts_with("description:") {
                let desc_start = line.find("description:").unwrap() + 12;
                let desc_value = line[desc_start..].trim();
                
                // Check if already quoted
                if !desc_value.starts_with('"') && !desc_value.starts_with('\'') && !desc_value.is_empty() {
                    // Check for special characters that need quoting
                    if desc_value.contains('<') || desc_value.contains('>') || 
                       desc_value.contains(':') || desc_value.contains('{') || desc_value.contains('}') {
                        let indent = line.len() - line.trim_start().len();
                        let fixed_line = format!("{}description: \"{}\"", " ".repeat(indent), desc_value);
                        fixed_lines.push(fixed_line);
                        continue;
                    }
                }
            }
            
            fixed_lines.push(line.to_string());
        }
        
        fixed_lines.join("\n")
    }

    /// Parse an agent file and extract metadata
    pub fn parse_file(content: &str) -> Result<Agent, String> {
        // Split content into frontmatter and system prompt
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        
        if parts.len() < 3 {
            return Err("Invalid agent file format: missing YAML frontmatter".to_string());
        }

        // Preprocess and parse YAML frontmatter
        let yaml_content = parts[1].trim();
        let preprocessed_yaml = Self::preprocess_yaml(yaml_content);
        let frontmatter: AgentFrontmatter = serde_yaml::from_str(&preprocessed_yaml)
            .map_err(|e| format!("Failed to parse YAML frontmatter: {}", e))?;

        // Extract system prompt (everything after the second ---)
        let system_prompt = parts[2].trim().to_string();

        if system_prompt.is_empty() {
            return Err("Agent file must contain a system prompt after the frontmatter".to_string());
        }

        // Get current timestamp
        let now = chrono::Utc::now().to_rfc3339();

        // Normalize color to match frontend expectations (capitalize first letter)
        let normalized_color = frontmatter.color.as_ref().map(|c| {
            let mut chars = c.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        });

        Ok(Agent {
            id: None, // File-based agents don't have numeric IDs
            name: frontmatter.name,
            icon: "🤖".to_string(), // Kept for frontend compatibility but not stored in files
            system_prompt,
            default_task: None,
            model: frontmatter.model.unwrap_or_else(|| "inherit".to_string()),
            enable_file_read: true,  // Default permissions for file-based agents
            enable_file_write: true,
            enable_network: false,
            hooks: None,
            created_at: now.clone(),
            updated_at: now,
            description: frontmatter.description,
            tools: frontmatter.tools,
            color: normalized_color,
        })
    }

    /// Generate markdown content from AgentData
    pub fn generate_markdown(agent: &Agent) -> String {
        let mut frontmatter = HashMap::new();
        
        frontmatter.insert("name", agent.name.clone());
        
        if let Some(ref desc) = agent.description {
            frontmatter.insert("description", desc.clone());
        }
        
        if let Some(ref tools) = agent.tools {
            frontmatter.insert("tools", tools.clone());
        }
        
        frontmatter.insert("model", agent.model.clone());
        
        if let Some(ref color) = agent.color {
            frontmatter.insert("color", color.clone());
        }
        
        // Build YAML frontmatter (no icon - Claude Code native agents don't use icons)
        let mut yaml_content = String::new();
        yaml_content.push_str("---\n");
        
        // Preserve order: name, description, tools, model, color (no icon)
        yaml_content.push_str(&format!("name: {}\n", agent.name));
        
        if let Some(ref desc) = agent.description {
            yaml_content.push_str(&format!("description: {}\n", desc));
        }
        
        if let Some(ref tools) = agent.tools {
            yaml_content.push_str(&format!("tools: {}\n", tools));
        }
        
        yaml_content.push_str(&format!("model: {}\n", agent.model));
        
        if let Some(ref color) = agent.color {
            yaml_content.push_str(&format!("color: {}\n", color));
        }
        yaml_content.push_str("---\n\n");
        
        // Add system prompt
        yaml_content.push_str(&agent.system_prompt);
        
        yaml_content
    }

    /// Get the .claude/agents directory path
    fn get_agents_directory(_project_path: Option<&str>) -> Result<PathBuf, String> {
        // For Claudio, we always use global agents from ~/.claude/agents/
        // Project agents will be handled separately in the future
        let home_dir = dirs::home_dir()
            .ok_or_else(|| "Failed to get home directory".to_string())?;
        let agents_dir = home_dir.join(".claude").join("agents");
        info!("Using global agents directory: {:?}", agents_dir);

        // Create directory if it doesn't exist
        if !agents_dir.exists() {
            fs::create_dir_all(&agents_dir)
                .map_err(|e| format!("Failed to create agents directory: {}", e))?;
        }

        Ok(agents_dir)
    }

    /// Convert agent name to safe filename
    fn name_to_filename(name: &str) -> String {
        name.to_lowercase()
            .replace(' ', "-")
            .replace('_', "-")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
            .collect::<String>()
            + ".md"
    }
}

/// Real-time JSONL reading and processing functions
impl AgentRunMetrics {
    /// Calculate metrics from JSONL content
    pub fn from_jsonl(jsonl_content: &str) -> Self {
        let mut total_tokens = 0i64;
        let mut cost_usd = 0.0f64;
        let mut message_count = 0i64;
        let mut start_time: Option<chrono::DateTime<chrono::Utc>> = None;
        let mut end_time: Option<chrono::DateTime<chrono::Utc>> = None;

        for line in jsonl_content.lines() {
            if let Ok(json) = serde_json::from_str::<JsonValue>(line) {
                message_count += 1;

                // Track timestamps
                if let Some(timestamp_str) = json.get("timestamp").and_then(|t| t.as_str()) {
                    if let Ok(timestamp) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
                        let utc_time = timestamp.with_timezone(&chrono::Utc);
                        if start_time.is_none() || utc_time < start_time.unwrap() {
                            start_time = Some(utc_time);
                        }
                        if end_time.is_none() || utc_time > end_time.unwrap() {
                            end_time = Some(utc_time);
                        }
                    }
                }

                // Extract token usage - check both top-level and nested message.usage
                let usage = json
                    .get("usage")
                    .or_else(|| json.get("message").and_then(|m| m.get("usage")));

                if let Some(usage) = usage {
                    if let Some(input_tokens) = usage.get("input_tokens").and_then(|t| t.as_i64()) {
                        total_tokens += input_tokens;
                    }
                    if let Some(output_tokens) = usage.get("output_tokens").and_then(|t| t.as_i64())
                    {
                        total_tokens += output_tokens;
                    }
                }

                // Extract cost information
                if let Some(cost) = json.get("cost").and_then(|c| c.as_f64()) {
                    cost_usd += cost;
                }
            }
        }

        let duration_ms = match (start_time, end_time) {
            (Some(start), Some(end)) => Some((end - start).num_milliseconds()),
            _ => None,
        };

        Self {
            duration_ms,
            total_tokens: if total_tokens > 0 {
                Some(total_tokens)
            } else {
                None
            },
            cost_usd: if cost_usd > 0.0 { Some(cost_usd) } else { None },
            message_count: if message_count > 0 {
                Some(message_count)
            } else {
                None
            },
        }
    }
}

/// Read JSONL content from a session file
pub async fn read_session_jsonl(session_id: &str, project_path: &str) -> Result<String, String> {
    let claude_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude")
        .join("projects");

    // Encode project path to match Claude Code's directory naming
    let encoded_project = project_path.replace('/', "-");
    let project_dir = claude_dir.join(&encoded_project);
    let session_file = project_dir.join(format!("{}.jsonl", session_id));

    if !session_file.exists() {
        return Err(format!(
            "Session file not found: {}",
            session_file.display()
        ));
    }

    match tokio::fs::read_to_string(&session_file).await {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read session file: {}", e)),
    }
}

/// Get agent run with real-time metrics
pub async fn get_agent_run_with_metrics(run: AgentRun) -> AgentRunWithMetrics {
    match read_session_jsonl(&run.session_id, &run.project_path).await {
        Ok(jsonl_content) => {
            let metrics = AgentRunMetrics::from_jsonl(&jsonl_content);
            AgentRunWithMetrics {
                run,
                metrics: Some(metrics),
                output: Some(jsonl_content),
            }
        }
        Err(e) => {
            log::warn!("Failed to read JSONL for session {}: {}", run.session_id, e);
            AgentRunWithMetrics {
                run,
                metrics: None,
                output: None,
            }
        }
    }
}

/// Database connection state - kept for compatibility with existing run management
/// Agents now use file-based storage, but other features still use SQLite
pub struct AgentDb(pub Mutex<Connection>);

/// Initialize the agents database (placeholder for compatibility)
/// In the file-based system for agents, this still initializes SQLite for other features
pub fn init_database(app: &tauri::AppHandle) -> SqliteResult<Connection> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

    let db_path = app_dir.join("agents.db");
    let conn = Connection::open(db_path)?;

    info!("Database initialized (agents use file-based storage, other features use SQLite)");
    Ok(conn)
}

/// List all agents from .claude/agents/*.md files
#[tauri::command]
pub async fn list_agents(project_path: Option<String>) -> Result<Vec<Agent>, String> {
    info!("list_agents called with project_path: {:?}", project_path);
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    info!("Looking for agents in directory: {:?}", agents_dir);
    
    let mut agents = Vec::new();
    
    if agents_dir.exists() {
        info!("Agents directory exists, reading entries...");
        let entries = fs::read_dir(&agents_dir)
            .map_err(|e| format!("Failed to read agents directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            info!("Found file: {:?}", path);
            
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                info!("Processing markdown file: {:?}", path);
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match AgentParser::parse_file(&content) {
                            Ok(mut agent) => {
                                // Get file metadata for timestamps
                                if let Ok(metadata) = fs::metadata(&path) {
                                    if let Ok(created) = metadata.created() {
                                        let created_dt = chrono::DateTime::<chrono::Utc>::from(created);
                                        agent.created_at = created_dt.to_rfc3339();
                                    }
                                    if let Ok(modified) = metadata.modified() {
                                        let modified_dt = chrono::DateTime::<chrono::Utc>::from(modified);
                                        agent.updated_at = modified_dt.to_rfc3339();
                                    }
                                }
                                agents.push(agent);
                            }
                            Err(e) => {
                                warn!("Failed to parse agent file {}: {}", path.display(), e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read agent file {}: {}", path.display(), e);
                    }
                }
            }
        }
    } else {
        info!("Agents directory does not exist: {:?}", agents_dir);
    }

    // Sort by name
    agents.sort_by(|a, b| a.name.cmp(&b.name));
    
    // Assign temporary IDs for frontend compatibility
    for (index, agent) in agents.iter_mut().enumerate() {
        agent.id = Some((index + 1) as i64);
    }
    
    info!("Returning {} agents", agents.len());
    for agent in &agents {
        info!("Agent: {} (id: {:?})", agent.name, agent.id);
    }
    
    Ok(agents)
}

/// Create a new agent file
#[tauri::command]
pub async fn create_agent(
    project_path: Option<String>,
    name: String,
    icon: String,
    system_prompt: String,
    default_task: Option<String>,
    model: Option<String>,
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
    hooks: Option<String>,
    description: Option<String>,
    tools: Option<String>,
    color: Option<String>,
) -> Result<Agent, String> {
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    let filename = AgentParser::name_to_filename(&name);
    let file_path = agents_dir.join(&filename);

    // Check if agent already exists
    if file_path.exists() {
        return Err(format!("Agent '{}' already exists", name));
    }

    let now = chrono::Utc::now().to_rfc3339();
    
    let agent = Agent {
        id: None,
        name: name.clone(),
        icon,
        system_prompt,
        default_task,
        model: model.unwrap_or_else(|| "sonnet".to_string()),
        enable_file_read: enable_file_read.unwrap_or(true),
        enable_file_write: enable_file_write.unwrap_or(true),
        enable_network: enable_network.unwrap_or(false),
        hooks,
        created_at: now.clone(),
        updated_at: now,
        description,
        tools,
        color,
    };

    let markdown_content = AgentParser::generate_markdown(&agent);
    
    fs::write(&file_path, markdown_content)
        .map_err(|e| format!("Failed to write agent file: {}", e))?;

    info!("Created agent '{}' at {}", name, file_path.display());
    Ok(agent)
}

/// Update an existing agent file
#[tauri::command]
pub async fn update_agent(
    project_path: Option<String>,
    name: String,
    icon: String,
    system_prompt: String,
    default_task: Option<String>,
    model: Option<String>,
    enable_file_read: Option<bool>,
    enable_file_write: Option<bool>,
    enable_network: Option<bool>,
    hooks: Option<String>,
    description: Option<String>,
    tools: Option<String>,
    color: Option<String>,
) -> Result<Agent, String> {
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    let filename = AgentParser::name_to_filename(&name);
    let file_path = agents_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Agent '{}' not found", name));
    }

    // Get original creation time
    let created_at = if let Ok(content) = fs::read_to_string(&file_path) {
        if let Ok(original_agent) = AgentParser::parse_file(&content) {
            original_agent.created_at
        } else {
            chrono::Utc::now().to_rfc3339()
        }
    } else {
        chrono::Utc::now().to_rfc3339()
    };

    let agent = Agent {
        id: None,
        name: name.clone(),
        icon,
        system_prompt,
        default_task,
        model: model.unwrap_or_else(|| "sonnet".to_string()),
        enable_file_read: enable_file_read.unwrap_or(true),
        enable_file_write: enable_file_write.unwrap_or(true),
        enable_network: enable_network.unwrap_or(false),
        hooks,
        created_at,
        updated_at: chrono::Utc::now().to_rfc3339(),
        description,
        tools,
        color,
    };

    let markdown_content = AgentParser::generate_markdown(&agent);
    
    fs::write(&file_path, markdown_content)
        .map_err(|e| format!("Failed to update agent file: {}", e))?;

    info!("Updated agent '{}' at {}", name, file_path.display());
    Ok(agent)
}

/// Delete an agent file
#[tauri::command]
pub async fn delete_agent(project_path: Option<String>, name: String) -> Result<(), String> {
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    let filename = AgentParser::name_to_filename(&name);
    let file_path = agents_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Agent '{}' not found", name));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete agent file: {}", e))?;

    info!("Deleted agent '{}' from {}", name, file_path.display());
    Ok(())
}

/// Get a single agent by name
#[tauri::command]
pub async fn get_agent(project_path: Option<String>, name: String) -> Result<Agent, String> {
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    let filename = AgentParser::name_to_filename(&name);
    let file_path = agents_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Agent '{}' not found", name));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read agent file: {}", e))?;

    let mut agent = AgentParser::parse_file(&content)?;
    
    // Get file metadata for timestamps
    if let Ok(metadata) = fs::metadata(&file_path) {
        if let Ok(created) = metadata.created() {
            let created_dt = chrono::DateTime::<chrono::Utc>::from(created);
            agent.created_at = created_dt.to_rfc3339();
        }
        if let Ok(modified) = metadata.modified() {
            let modified_dt = chrono::DateTime::<chrono::Utc>::from(modified);
            agent.updated_at = modified_dt.to_rfc3339();
        }
    }

    Ok(agent)
}

// TODO: The following functions need to be adapted for the new file-based system
// For now, they return placeholder implementations to maintain API compatibility

/// List agent runs (placeholder - needs implementation for file-based runs)
#[tauri::command]
pub async fn list_agent_runs(
    _agent_name: Option<String>,
) -> Result<Vec<AgentRun>, String> {
    // TODO: Implement file-based agent run tracking
    warn!("list_agent_runs not yet implemented for file-based system");
    Ok(Vec::new())
}

/// Get a single agent run by ID (placeholder)
#[tauri::command]
pub async fn get_agent_run(_run_id: i64) -> Result<AgentRun, String> {
    // TODO: Implement file-based agent run tracking
    Err("get_agent_run not yet implemented for file-based system".to_string())
}

/// Get agent run with real-time metrics (placeholder)
#[tauri::command]
pub async fn get_agent_run_with_real_time_metrics(
    _run_id: i64,
) -> Result<AgentRunWithMetrics, String> {
    // TODO: Implement file-based agent run tracking
    Err("get_agent_run_with_real_time_metrics not yet implemented for file-based system".to_string())
}

/// List agent runs with real-time metrics (placeholder)
#[tauri::command]
pub async fn list_agent_runs_with_metrics(
    _agent_name: Option<String>,
) -> Result<Vec<AgentRunWithMetrics>, String> {
    // TODO: Implement file-based agent run tracking
    warn!("list_agent_runs_with_metrics not yet implemented for file-based system");
    Ok(Vec::new())
}

/// Execute a CC agent with streaming output (placeholder - needs Task tool integration)
#[tauri::command]
pub async fn execute_agent(
    _app: AppHandle,
    _agent_name: String,
    _project_path: String,
    _task: String,
    _model: Option<String>,
) -> Result<i64, String> {
    // TODO: Replace with Claude Code Task tool integration
    warn!("execute_agent not yet implemented for file-based system with Task tool");
    Err("Agent execution will be implemented with Claude Code Task tool integration".to_string())
}

// Placeholder implementations for other functions to maintain API compatibility
// These will need to be implemented or removed based on the new file-based architecture

#[tauri::command]
pub async fn list_running_sessions() -> Result<Vec<AgentRun>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn kill_agent_session(_app: AppHandle, _run_id: i64) -> Result<bool, String> {
    Err("kill_agent_session not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn get_session_status(_run_id: i64) -> Result<Option<String>, String> {
    Err("get_session_status not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn cleanup_finished_processes() -> Result<Vec<i64>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn get_live_session_output(_run_id: i64) -> Result<String, String> {
    Err("get_live_session_output not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn get_session_output(_run_id: i64) -> Result<String, String> {
    Err("get_session_output not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn stream_session_output(_app: AppHandle, _run_id: i64) -> Result<(), String> {
    Err("stream_session_output not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn export_agent(project_path: Option<String>, name: String) -> Result<String, String> {
    let agent = get_agent(project_path, name).await?;
    
    let export_data = AgentExport {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        agent: AgentData {
            name: agent.name,
            icon: agent.icon,
            system_prompt: agent.system_prompt,
            default_task: agent.default_task,
            model: agent.model,
            hooks: agent.hooks,
            description: agent.description,
            tools: agent.tools,
            color: agent.color,
        },
    };

    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize agent: {}", e))
}

#[tauri::command]
pub async fn export_agent_to_file(
    project_path: Option<String>,
    name: String,
    file_path: String,
) -> Result<(), String> {
    // Get the source agent file path
    let agents_dir = AgentParser::get_agents_directory(project_path.as_deref())?;
    let filename = AgentParser::name_to_filename(&name);
    let source_path = agents_dir.join(&filename);

    if !source_path.exists() {
        return Err(format!("Agent '{}' not found", name));
    }

    // Copy the .md file directly
    fs::copy(&source_path, &file_path)
        .map_err(|e| format!("Failed to copy agent file: {}", e))?;
    
    info!("Exported agent '{}' to {}", name, file_path);
    Ok(())
}

#[tauri::command]
pub async fn import_agent(project_path: Option<String>, json_data: String) -> Result<Agent, String> {
    let export_data: AgentExport =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid JSON format: {}", e))?;

    if export_data.version != 1 {
        return Err(format!(
            "Unsupported export version: {}. This version of the app only supports version 1.",
            export_data.version
        ));
    }

    let agent_data = export_data.agent;
    
    // Check if agent already exists
    let agents = list_agents(project_path.clone()).await?;
    let existing_names: Vec<String> = agents.iter().map(|a| a.name.clone()).collect();
    
    let final_name = if existing_names.contains(&agent_data.name) {
        format!("{} (Imported)", agent_data.name)
    } else {
        agent_data.name
    };

    create_agent(
        project_path,
        final_name,
        agent_data.icon,
        agent_data.system_prompt,
        agent_data.default_task,
        Some(agent_data.model),
        Some(true),  // enable_file_read
        Some(true),  // enable_file_write
        Some(false), // enable_network
        agent_data.hooks,
        agent_data.description,
        agent_data.tools,
        agent_data.color,
    ).await
}

#[tauri::command]
pub async fn import_agent_from_file(
    project_path: Option<String>,
    file_path: String,
) -> Result<Agent, String> {
    let json_data =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    import_agent(project_path, json_data).await
}

// Remaining functions that depend on external APIs or complex process management
// are kept as placeholders for now

#[tauri::command] 
pub async fn get_claude_binary_path() -> Result<Option<String>, String> {
    Err("get_claude_binary_path not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn set_claude_binary_path(_path: String) -> Result<(), String> {
    Err("set_claude_binary_path not implemented in file-based system".to_string())
}

#[tauri::command]
pub async fn list_claude_installations(_app: AppHandle) -> Result<Vec<crate::claude_binary::ClaudeInstallation>, String> {
    let installations = crate::claude_binary::discover_claude_installations();
    if installations.is_empty() {
        return Err("No Claude Code installations found on the system".to_string());
    }
    Ok(installations)
}

#[tauri::command]
pub async fn fetch_github_agents() -> Result<Vec<String>, String> {
    // TODO: Implement GitHub agent fetching for new format
    warn!("fetch_github_agents not yet adapted for new file format");
    Ok(Vec::new())
}

#[tauri::command]
pub async fn fetch_github_agent_content(_download_url: String) -> Result<AgentExport, String> {
    warn!("fetch_github_agent_content not yet adapted for new file format");
    Err("GitHub agent content fetching not yet implemented".to_string())
}

#[tauri::command]
pub async fn import_agent_from_github(
    _project_path: Option<String>,
    _download_url: String,
) -> Result<Agent, String> {
    warn!("import_agent_from_github not yet adapted for new file format");
    Err("GitHub agent import not yet implemented".to_string())
}

#[tauri::command]
pub async fn load_agent_session_history(session_id: String) -> Result<Vec<serde_json::Value>, String> {
    // This function can remain as-is since it deals with Claude Code session files
    log::info!("Loading agent session history for session: {}", session_id);

    let claude_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude");

    let projects_dir = claude_dir.join("projects");
    
    if !projects_dir.exists() {
        log::error!("Projects directory not found at: {:?}", projects_dir);
        return Err("Projects directory not found".to_string());
    }

    // Search for the session file in all project directories
    let mut session_file_path = None;
    log::info!("Searching for session file {} in all project directories", session_id);
    
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                log::debug!("Checking project directory: {}", dir_name);
                
                let potential_session_file = path.join(format!("{}.jsonl", session_id));
                if potential_session_file.exists() {
                    log::info!("Found session file at: {:?}", potential_session_file);
                    session_file_path = Some(potential_session_file);
                    break;
                } else {
                    log::debug!("Session file not found in: {}", dir_name);
                }
            }
        }
    } else {
        log::error!("Failed to read projects directory");
    }

    if let Some(session_path) = session_file_path {
        let file = std::fs::File::open(&session_path)
            .map_err(|e| format!("Failed to open session file: {}", e))?;

        let reader = BufReader::new(file);
        let mut messages = Vec::new();

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    messages.push(json);
                }
            }
        }

        Ok(messages)
    } else {
        Err(format!("Session file not found: {}", session_id))
    }
}