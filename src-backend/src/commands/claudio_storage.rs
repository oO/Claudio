use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::fs;
use tokio::sync::RwLock;
use once_cell::sync::Lazy;

/// Global in-memory store for Claudio session metadata
/// Key: claudio_id, Value: ClaudioSession
static CLAUDIO_SESSIONS: Lazy<Arc<RwLock<HashMap<String, ClaudioSession>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

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
    /// History of previous session IDs that need cleanup (newest first)
    #[serde(default)]
    pub session_history: Vec<String>,
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
        session_history: Vec::new(),
    };
    
    // Put the session in memory immediately during creation
    {
        let mut sessions = CLAUDIO_SESSIONS.write().await;
        sessions.insert(claudio_id.clone(), new_session.clone());
        log::info!("💾 Cached new Claudio session in memory: {}", claudio_id);
    }
    
    update_claudio_session(claudio_id.clone(), project_path, new_session).await?;
    
    log::info!("✨ Created new Claudio session: {}", claudio_id);
    Ok(claudio_id)
}

/// Update or create session metadata (updates memory immediately, persists to disk async)
#[command]
pub async fn update_claudio_session(
    claudio_session_id: String,
    project_path: String,
    updates: ClaudioSession,
) -> Result<ClaudioSession, String> {
    // 1. Update memory immediately (single source of truth)
    {
        let mut sessions = CLAUDIO_SESSIONS.write().await;
        sessions.insert(claudio_session_id.clone(), updates.clone());
        log::info!("⚡ Updated Claudio session in memory: {}", claudio_session_id);
    }
    
    // 2. Persist to disk asynchronously (doesn't block)
    let project_path_clone = project_path.clone();
    let updates_clone = updates.clone();
    tokio::spawn(async move {
        if let Err(e) = persist_session_to_disk(&claudio_session_id, &project_path_clone, &updates_clone).await {
            log::error!("Failed to persist Claudio session to disk: {}", e);
        } else {
            log::info!("💾 Successfully persisted Claudio session to disk: {}", claudio_session_id);
        }
    });
    
    Ok(updates)
}

/// Internal function to persist session data to disk
async fn persist_session_to_disk(
    claudio_session_id: &str,
    project_path: &str,
    session: &ClaudioSession,
) -> Result<(), String> {
    ensure_claudio_dirs().await?;
    
    let project_dir = get_project_claudio_dir(project_path)?;
    fs::create_dir_all(&project_dir).await
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));
    
    let json_content = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    
    log::debug!("Writing session file: {}", session_file.display());
    
    fs::write(&session_file, json_content).await
        .map_err(|e| format!("Failed to write session file {}: {}", session_file.display(), e))?;
    
    Ok(())
}

/// Get session metadata (reads from memory first, falls back to disk)
#[command]
pub async fn get_claudio_session(
    claudio_session_id: String,
    project_path: String,
) -> Result<ClaudioSession, String> {
    // Try memory first (fast path)
    {
        let sessions = CLAUDIO_SESSIONS.read().await;
        if let Some(session) = sessions.get(&claudio_session_id) {
            log::debug!("✅ Retrieved Claudio session from memory: {}", claudio_session_id);
            return Ok(session.clone());
        }
    }
    
    // Fallback to disk (slower path - happens on startup or cache miss)
    log::debug!("📁 Session not in memory, loading from disk: {}", claudio_session_id);
    let project_dir = get_project_claudio_dir(&project_path)?;
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));
    
    if !session_file.exists() {
        return Err("Session metadata file not found".to_string());
    }
    
    let content = fs::read_to_string(&session_file).await
        .map_err(|e| format!("Failed to read session: {}", e))?;
    
    let session: ClaudioSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session: {}", e))?;
    
    // Cache in memory for next time
    {
        let mut sessions = CLAUDIO_SESSIONS.write().await;
        sessions.insert(claudio_session_id.clone(), session.clone());
        log::debug!("💾 Cached Claudio session in memory: {}", claudio_session_id);
    }
    
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

/// Unified cleanup function for both Claude and Claudio session files
/// This is the DRY function that all delete operations should use
pub async fn cleanup_session_files(
    project_path: &str,
    claude_session_id: &str,
) -> Result<(u32, u32), String> {
    let mut claude_files_deleted = 0;
    let mut claudio_files_deleted = 0;

    // 1. Delete Claude session file (.claude/projects/*/session_id.jsonl)
    let claude_dir = crate::commands::claude::get_claude_dir().map_err(|e| e.to_string())?;
    let project_id = project_path.replace("/", "-");
    let claude_session_file = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", claude_session_id));
    
    if claude_session_file.exists() {
        std::fs::remove_file(&claude_session_file)
            .map_err(|e| format!("Failed to delete Claude session file: {}", e))?;
        claude_files_deleted += 1;
        log::info!("🗑️ Deleted Claude session: {}", claude_session_file.display());
    }

    // 2. Find and delete any Claudio sessions that reference this Claude session
    let project_claudio_dir = match get_project_claudio_dir(project_path) {
        Ok(dir) => dir,
        Err(_) => return Ok((claude_files_deleted, claudio_files_deleted)), // No claudio dir = nothing to clean
    };

    if project_claudio_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&project_claudio_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(session) = serde_json::from_str::<ClaudioSession>(&content) {
                            // Delete if this claudio session references the Claude session we're deleting
                            if let Some(ref session_id) = session.session_id {
                                if session_id == claude_session_id {
                                    if std::fs::remove_file(&path).is_ok() {
                                        claudio_files_deleted += 1;
                                        log::info!("🗑️ Deleted Claudio session: {}", path.display());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok((claude_files_deleted, claudio_files_deleted))
}

/// Cleanup orphaned files across the entire system
/// This should be called on app startup to ensure data integrity
#[command]
pub async fn cleanup_orphaned_files() -> Result<serde_json::Value, String> {
    log::info!("🧹 Starting orphaned files cleanup...");
    
    let mut stats = OrphanCleanupStats::default();
    
    // Get all projects
    let claude_dir = crate::commands::claude::get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");
    
    if !projects_dir.exists() {
        return Ok(stats.to_json());
    }

    // For each project, find orphans
    if let Ok(project_entries) = std::fs::read_dir(&projects_dir) {
        for project_entry in project_entries.flatten() {
            let project_path = project_entry.path();
            let project_id = project_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            
            if project_path.is_dir() {
                stats.merge(cleanup_project_orphans(&project_path, project_id).await?);
            }
        }
    }
    
    log::info!("🧹 Orphan cleanup complete: {}", stats.summary());
    Ok(stats.to_json())
}

#[derive(Default)]
struct OrphanCleanupStats {
    orphaned_claudio_sessions: u32,
    orphaned_todos: u32,
    orphaned_timelines: u32,
    projects_processed: u32,
}

impl OrphanCleanupStats {
    fn merge(&mut self, other: OrphanCleanupStats) {
        self.orphaned_claudio_sessions += other.orphaned_claudio_sessions;
        self.orphaned_todos += other.orphaned_todos;
        self.orphaned_timelines += other.orphaned_timelines;
        self.projects_processed += other.projects_processed;
    }
    
    fn summary(&self) -> String {
        format!("{} claudio sessions, {} todos, {} timelines across {} projects", 
                self.orphaned_claudio_sessions, self.orphaned_todos, 
                self.orphaned_timelines, self.projects_processed)
    }
    
    fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "success": true,
            "orphaned_claudio_sessions": self.orphaned_claudio_sessions,
            "orphaned_todos": self.orphaned_todos,
            "orphaned_timelines": self.orphaned_timelines,
            "projects_processed": self.projects_processed,
            "message": self.summary()
        })
    }
}

async fn cleanup_project_orphans(
    project_path: &std::path::Path,
    project_id: &str,
) -> Result<OrphanCleanupStats, String> {
    let mut stats = OrphanCleanupStats::default();
    stats.projects_processed = 1;
    
    // Get all existing Claude session IDs for this project
    let mut existing_sessions = std::collections::HashSet::new();
    if let Ok(entries) = std::fs::read_dir(project_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    existing_sessions.insert(session_id.to_string());
                }
            }
        }
    }
    
    // Decode project path for claudio directory lookup
    let decoded_project_path = crate::commands::claude::decode_project_path(project_id);
    
    // 1. Cleanup orphaned Claudio sessions
    if let Ok(claudio_dir) = get_project_claudio_dir(&decoded_project_path) {
        if claudio_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&claudio_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(session) = serde_json::from_str::<ClaudioSession>(&content) {
                                // Check if the referenced Claude session exists
                                if let Some(ref claude_session_id) = session.session_id {
                                    if !existing_sessions.contains(claude_session_id) {
                                        // Orphaned claudio session - delete it
                                        if std::fs::remove_file(&path).is_ok() {
                                            stats.orphaned_claudio_sessions += 1;
                                            log::info!("🗑️ Deleted orphaned Claudio session: {}", path.display());
                                        }
                                    }
                                } else {
                                    // Claudio session with no Claude session reference - also orphaned
                                    if std::fs::remove_file(&path).is_ok() {
                                        stats.orphaned_claudio_sessions += 1;
                                        log::info!("🗑️ Deleted empty Claudio session: {}", path.display());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 2. Cleanup orphaned todos
    let claude_dir = crate::commands::claude::get_claude_dir().map_err(|e| e.to_string())?;
    let todos_dir = claude_dir.join("todos");
    if todos_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&todos_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                        if !existing_sessions.contains(session_id) {
                            // Orphaned todo - delete it
                            if std::fs::remove_file(&path).is_ok() {
                                stats.orphaned_todos += 1;
                                log::info!("🗑️ Deleted orphaned todo: {}", path.display());
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 3. Cleanup orphaned timelines
    let timelines_dir = project_path.join("timelines");
    if timelines_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&timelines_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                        if !existing_sessions.contains(session_id) {
                            // Orphaned timeline - delete it
                            if std::fs::remove_file(&path).is_ok() {
                                stats.orphaned_timelines += 1;
                                log::info!("🗑️ Deleted orphaned timeline: {}", path.display());
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(stats)
}

