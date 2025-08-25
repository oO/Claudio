use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;
use tokio::fs;

/// Session metadata stored in ~/.claudio/projects/<project_id>/<session_id>.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudioSession {
    /// Unique identifier for this Claudio wrapper session
    pub claudio_id: String,
    /// Current Claude CLI session ID (the actual conversation)
    pub session_id: Option<String>,
    /// Project path this session belongs to
    pub project_path: String,
    /// Session status
    pub status: SessionStatus,
    /// Claude CLI settings for this session
    pub settings: ClaudeSettings,
    /// UUID of the last message in the session (for resume detection)
    #[serde(default)]
    pub last_message_uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Completed,
}

/// Claude CLI controllable settings per session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSettings {
    /// Model to use (sonnet, haiku, opus)
    pub model: Option<String>,
    /// Maximum number of conversation turns
    pub max_turns: Option<u32>,
    /// System prompt or path to file
    pub system_prompt: Option<String>,
    /// Append system prompt content
    pub append_system_prompt: Option<String>,
    /// Tool allowlist
    pub tools: Option<Vec<String>>,
    /// Working directory override
    pub working_directory: Option<String>,
}

impl Default for ClaudeSettings {
    fn default() -> Self {
        Self {
            model: None,
            max_turns: None,
            system_prompt: None,
            append_system_prompt: None,
            tools: None,
            working_directory: None,
        }
    }
}

/// Get the ~/.claudio directory path
pub fn get_claudio_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Failed to find home directory")?;
    Ok(home_dir.join(".claudio"))
}

/// Get project-specific claudio directory
pub fn get_project_claudio_dir(project_path: &str) -> Result<PathBuf, String> {
    let claudio_dir = get_claudio_dir()?;
    // Encode project path to match Claude Code's format: replace "/" and spaces with "-"
    let project_encoded = project_path.replace("/", "-").replace("\\", "-").replace(" ", "-");
    Ok(claudio_dir.join("projects").join(project_encoded))
}

/// Get the path to Claudio's global settings file
pub fn get_claudio_settings_file() -> Result<PathBuf, String> {
    let claudio_dir = get_claudio_dir()?;
    Ok(claudio_dir.join("settings.json"))
}

/// Ensure the claudio directory structure exists
pub async fn ensure_claudio_dirs() -> Result<(), String> {
    let claudio_dir = get_claudio_dir()?;
    
    // Create main directories
    fs::create_dir_all(&claudio_dir).await
        .map_err(|e| format!("Failed to create ~/.claudio: {}", e))?;
    
    fs::create_dir_all(claudio_dir.join("projects")).await
        .map_err(|e| format!("Failed to create ~/.claudio/projects: {}", e))?;
    
    // Create settings.json if it doesn't exist
    let settings_path = claudio_dir.join("settings.json");
    if !settings_path.exists() {
        let default_settings = serde_json::json!({
            "version": "1.0.0",
            "created_at": chrono::Utc::now().to_rfc3339()
        });
        
        fs::write(&settings_path, serde_json::to_string_pretty(&default_settings).unwrap()).await
            .map_err(|e| format!("Failed to create settings.json: {}", e))?;
    }
    
    Ok(())
}


/// Create a new Claudio session (returns the claudio_id)
#[command]
pub async fn create_claudio_session(
    project_path: String,
    settings: ClaudeSettings,
) -> Result<String, String> {
    ensure_claudio_dirs().await?;
    
    let claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());
    
    let new_session = ClaudioSession {
        claudio_id: claudio_id.clone(),
        session_id: None, // Will be filled when Claude CLI responds
        project_path: project_path.clone(),
        status: SessionStatus::Active,
        settings,
        last_message_uuid: None,
    };
    
    update_claudio_session(claudio_id.clone(), project_path, new_session).await?;
    
    log::info!("✨ Created new Claudio session: {}", claudio_id);
    Ok(claudio_id)
}

/// Update or create session metadata (upsert pattern)  
#[command]
pub async fn update_claudio_session(
    claudio_session_id: String,
    project_path: String,
    updates: ClaudioSession,
) -> Result<ClaudioSession, String> {
    ensure_claudio_dirs().await?;
    
    let project_dir = get_project_claudio_dir(&project_path)?;
    fs::create_dir_all(&project_dir).await
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));
    
    let json_content = serde_json::to_string_pretty(&updates)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    
    log::info!("Writing session file: {}", session_file.display());
    log::debug!("Session data: {}", json_content);
    
    fs::write(&session_file, json_content).await
        .map_err(|e| format!("Failed to write session file {}: {}", session_file.display(), e))?;
    
    log::info!("✅ Successfully saved Claudio session: {}", session_file.display());
    Ok(updates)
}

/// Get session metadata
#[command]
pub async fn get_claudio_session(
    claudio_session_id: String,
    project_path: String,
) -> Result<ClaudioSession, String> {
    let project_dir = get_project_claudio_dir(&project_path)?;
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));
    
    if !session_file.exists() {
        return Err("Session metadata file not found".to_string());
    }
    
    let content = fs::read_to_string(&session_file).await
        .map_err(|e| format!("Failed to read session: {}", e))?;
    
    let session: ClaudioSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session: {}", e))?;
    
    Ok(session)
}

/// List all sessions for a project
#[command]
pub async fn list_claudio_sessions(project_path: String) -> Result<Vec<ClaudioSession>, String> {
    let project_dir = get_project_claudio_dir(&project_path)?;
    
    if !project_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut sessions = Vec::new();
    let mut entries = fs::read_dir(&project_dir).await
        .map_err(|e| format!("Failed to read project directory: {}", e))?;
    
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| format!("Failed to read directory entry: {}", e))? 
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            match fs::read_to_string(&path).await {
                Ok(content) => {
                    match serde_json::from_str::<ClaudioSession>(&content) {
                        Ok(session) => sessions.push(session),
                        Err(e) => log::warn!("Failed to parse session {}: {}", path.display(), e),
                    }
                }
                Err(e) => log::warn!("Failed to read session file {}: {}", path.display(), e),
            }
        }
    }
    
    // Sort by file modification time (newest first)
    sessions.sort_by(|a, b| b.claudio_id.cmp(&a.claudio_id));
    
    Ok(sessions)
}

/// Delete session metadata
#[command]
pub async fn delete_claudio_session(
    claudio_session_id: String,
    project_path: String,
) -> Result<(), String> {
    let project_dir = get_project_claudio_dir(&project_path)?;
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));
    
    if !session_file.exists() {
        return Err("Session metadata file not found".to_string());
    }
    
    fs::remove_file(&session_file).await
        .map_err(|e| format!("Failed to delete session metadata: {}", e))?;
    
    log::info!("🗑️ Deleted session metadata: {}", session_file.display());
    Ok(())
}

/// Update the last message UUID for resume detection
#[command]
pub async fn update_last_message_uuid(
    claudio_session_id: String,
    project_path: String,
    last_message_uuid: String,
) -> Result<(), String> {
    // Get the current session
    let mut session = get_claudio_session(claudio_session_id.clone(), project_path.clone()).await?;
    
    // Update the last message UUID
    session.last_message_uuid = Some(last_message_uuid.clone());
    
    // Save it back
    update_claudio_session(claudio_session_id, project_path, session).await?;
    
    log::debug!("📍 Updated last message UUID: {}", last_message_uuid);
    Ok(())
}