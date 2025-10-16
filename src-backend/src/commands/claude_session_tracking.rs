use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter};
use tokio::fs;
use std::path::Path;
use crate::paths::{claudio_home_dir, CLAUDE_PROJECTS_DIR, CLAUDE_SESSION_PREFIX, JSON_EXTENSION};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveClaudeSession {
    pub session_id: String,
    pub project_path: String,
    pub status: String, // "idle", "active"
    #[serde(rename = "type")]
    pub session_type: String,
    /// Latest hook event data (raw JSON from hook scripts)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hook: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeThinkingEvent {
    pub session_id: String,
    pub project_path: String,
    pub status: String, // "active" or "idle"
    pub title: Option<String>,
    pub message: Option<String>,
    /// Hook data from the session file (includes hook_event_name, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hook: Option<serde_json::Value>,
}

/// Start thinking status for a native Claude session
#[command]
pub async fn start_claude_thinking(
    app: AppHandle,
    session_id: String,
    project_path: String,
) -> Result<(), String> {
    log::debug!("🤔 Starting thinking status for Claude session: {}", session_id);
    
    // Get random thinking content (reuse from claude_direct.rs)
    let (thinking_title, thinking_message) = get_thinking_content();
    
    // Emit event to frontend for real-time updates
    let event_data = ClaudeThinkingEvent {
        session_id: session_id.clone(),
        project_path,
        status: "active".to_string(),
        title: Some(thinking_title),
        message: Some(thinking_message),
        hook: None, // No hook data for manual thinking events
    };
    
    app.emit("claude-session-thinking", &event_data)
        .map_err(|e| format!("Failed to emit thinking event: {}", e))?;
    
    log::debug!("Claude thinking event emitted for session: {}", session_id);
    Ok(())
}

/// End thinking status for a native Claude session
#[command]
pub async fn end_claude_thinking(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    log::debug!("Ending thinking status for Claude session: {}", session_id);
    
    // Emit event to frontend
    let event_data = ClaudeThinkingEvent {
        session_id: session_id.clone(),
        project_path: "".to_string(), // Not needed for end event
        status: "idle".to_string(),
        title: None,
        message: None,
        hook: None, // No hook data for end events
    };
    
    app.emit("claude-session-thinking", &event_data)
        .map_err(|e| format!("Failed to emit thinking end event: {}", e))?;
    
    log::info!("🏁 Claude thinking ended for session: {}", session_id);
    Ok(())
}

/// Get all live Claude sessions by scanning claude-*.json files
/// Returns sessions with project_id (directory name), not project_path
#[command]
pub async fn get_live_claude_sessions() -> Result<Vec<LiveClaudeSession>, String> {
    let claudio_projects_dir = claudio_home_dir()?.join(CLAUDE_PROJECTS_DIR);
    log::info!("Scanning for live Claude sessions in: {}", claudio_projects_dir.display());

    if !claudio_projects_dir.exists() {
        log::warn!("Claude projects directory does not exist: {}", claudio_projects_dir.display());
        return Ok(vec![]);
    }

    let mut live_sessions = Vec::new();

    // Read all project directories
    let mut project_dirs = fs::read_dir(&claudio_projects_dir).await
        .map_err(|e| format!("Failed to read claudio projects directory: {}", e))?;

    while let Some(entry) = project_dirs.next_entry().await
        .map_err(|e| format!("Failed to read directory entry: {}", e))? {

        if !entry.file_type().await.map_err(|e| format!("Failed to get file type: {}", e))?.is_dir() {
            continue;
        }

        let project_dir = entry.path();

        // Get project_id from directory name (e.g., "-Users-olivier-Projects-claudio")
        let project_id = match project_dir.file_name().and_then(|n| n.to_str()) {
            Some(id) => id.to_string(),
            None => continue,
        };

        // Read files in this project directory
        let mut files = fs::read_dir(&project_dir).await
            .map_err(|e| format!("Failed to read project directory: {}", e))?;

        while let Some(file_entry) = files.next_entry().await
            .map_err(|e| format!("Failed to read file entry: {}", e))? {

            let filename = file_entry.file_name();
            let filename_str = filename.to_string_lossy();

            // Look for claude-*.json files (not claudio-*.json)
            if filename_str.starts_with(CLAUDE_SESSION_PREFIX) && filename_str.ends_with(JSON_EXTENSION) {
                // Read session and use project_id as the identifier
                if let Ok(mut session) = read_claude_session_file(&file_entry.path()).await {
                    session.project_path = project_id.clone(); // Store project_id, not real path
                    live_sessions.push(session);
                } else {
                    log::warn!("Failed to parse Claude session file: {}", file_entry.path().display());
                }
            }
        }
    }

    log::info!("Found {} live Claude sessions", live_sessions.len());
    Ok(live_sessions)
}

/// Get thinking status for a specific Claude session
#[command] 
pub async fn get_claude_session_status(session_id: String) -> Result<Option<LiveClaudeSession>, String> {
    log::debug!("Getting status for Claude session: {}", session_id);
    
    let sessions = get_live_claude_sessions().await?;
    let session = sessions.into_iter().find(|s| s.session_id == session_id);
    
    Ok(session)
}

// Helper functions

/// Read a claude session file and parse it
async fn read_claude_session_file(path: &Path) -> Result<LiveClaudeSession, String> {
    let content = fs::read_to_string(path).await
        .map_err(|e| format!("Failed to read session file: {}", e))?;
    
    let session: LiveClaudeSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session file: {}", e))?;
    
    Ok(session)
}

/// Get random thinking content - Public API for frontend
#[tauri::command]
pub async fn get_random_thinking_content() -> Result<(String, String), String> {
    let (title, message) = get_thinking_content();
    Ok((title, message))
}

/// Get random thinking content (imported from claude_direct.rs functionality)
fn get_thinking_content() -> (String, String) {
    // Import the same functions used in claude_direct.rs
    let title = get_random_thinking_title();
    let message = get_random_thinking_message();
    (title, message)
}

/// Get a random thinking title from embedded resource
fn get_random_thinking_title() -> String {
    let titles = load_thinking_titles_from_file().expect("Embedded resource should always be available");
    
    use rand::seq::SliceRandom;
    titles.choose(&mut rand::thread_rng())
        .cloned()
        .expect("Should have at least one thinking title")
}

/// Get a random thinking message (haiku) from embedded resource  
fn get_random_thinking_message() -> String {
    let messages = load_thinking_messages_from_file().expect("Embedded resource should always be available");
    
    use rand::seq::SliceRandom;
    messages.choose(&mut rand::thread_rng())
        .cloned()
        .expect("Should have at least one thinking message")
}

/// Load thinking titles from embedded resource
fn load_thinking_titles_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let content = include_str!("../../resources/claude_thinking_titles.txt");
    
    let titles: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    
    // log::debug!("Loaded {} thinking titles from embedded resource", titles.len());
    Ok(titles)
}

/// Load thinking messages (haikus) from embedded resource
fn load_thinking_messages_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let content = include_str!("../../resources/claude_thinking_messages.txt");
    
    let messages: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    
    // log::debug!("Loaded {} thinking messages from embedded resource", messages.len());
    Ok(messages)
}