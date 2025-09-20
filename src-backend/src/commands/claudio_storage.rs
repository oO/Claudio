use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use tokio::fs;
use tokio::sync::RwLock;
use tokio::io::{BufReader, AsyncBufReadExt};
use once_cell::sync::Lazy;
use chrono;
use crate::paths::{claudio_home_dir, CLAUDIO_SETTINGS_FILE, CLAUDE_PROJECTS_DIR, JSON_EXTENSION};

/// Global in-memory store for Claudio session metadata
/// Key: claudio_id, Value: ClaudioSession
pub static CLAUDIO_SESSIONS: Lazy<Arc<RwLock<HashMap<String, ClaudioSession>>>> = 
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Individual session information (current or historical)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionInfo {
    /// Claude CLI session ID
    pub session_id: String,
    /// UUID of the last message in this session
    pub last_message_uuid: String,
    /// Timestamp of the last message in this session
    pub last_message_timestamp: chrono::DateTime<chrono::Utc>,
}

/// Session metadata stored in ~/.claudio/projects/<project_id>/<session_id>.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudioSession {
    /// Unique identifier for this Claudio wrapper session
    pub claudio_id: String,
    /// Project path this session belongs to
    pub project_path: String,
    /// Current active session (None if no session is active)
    #[serde(default)]
    pub current_session: Option<SessionInfo>,
    /// Session status
    pub status: SessionStatus,
    /// History of previous sessions (newest first)
    #[serde(default)]
    pub session_history: Vec<SessionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Idle,
    Completed,
    Notification,
    Compact,
}



/// Get the ~/.claudio directory path
pub fn get_claudio_dir() -> Result<PathBuf, String> {
    claudio_home_dir()
}

/// Get project-specific claudio directory
pub fn get_project_claudio_dir(project_path: &str) -> Result<PathBuf, String> {
    let claudio_dir = get_claudio_dir()?;
    // Encode project path to match Claude Code's format: replace "/" and spaces with "-"
    let project_encoded = project_path.replace("/", "-").replace("\\", "-").replace(" ", "-");
    Ok(claudio_dir.join(CLAUDE_PROJECTS_DIR).join(project_encoded))
}

/// Get the path to Claudio's global settings file
pub fn get_claudio_settings_file() -> Result<PathBuf, String> {
    let claudio_dir = get_claudio_dir()?;
    Ok(claudio_dir.join(CLAUDIO_SETTINGS_FILE))
}

/// Ensure the claudio directory structure exists
pub async fn ensure_claudio_dirs() -> Result<(), String> {
    let claudio_dir = get_claudio_dir()?;
    
    // Create main directories (only log if there are actual errors)
    fs::create_dir_all(&claudio_dir).await
        .map_err(|e| format!("Failed to create ~/.claudio: {}", e))?;
    
    fs::create_dir_all(claudio_dir.join(CLAUDE_PROJECTS_DIR)).await
        .map_err(|e| format!("Failed to create ~/.claudio/projects: {}", e))?;
    
    // Create settings.json if it doesn't exist
    let settings_path = claudio_dir.join(CLAUDIO_SETTINGS_FILE);
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

/// Initialize the in-memory cache by loading all existing Claudio sessions from disk
/// This should be called once at application startup
pub async fn initialize_claudio_cache() -> Result<(), String> {
    let claudio_dir = get_claudio_dir()?;
    let projects_dir = claudio_dir.join(CLAUDE_PROJECTS_DIR);

    if !projects_dir.exists() {
        log::debug!("No projects directory found, cache initialized empty");
        return Ok(()); // No projects yet
    }

    let mut cache = CLAUDIO_SESSIONS.write().await;
    let mut loaded_count = 0;

    // Iterate through all project directories
    let mut project_entries = fs::read_dir(&projects_dir).await
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    while let Some(project_entry) = project_entries.next_entry().await
        .map_err(|e| format!("Failed to read project entry: {}", e))?
    {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }

        // Read all claudio-*.json files in this project directory
        let mut session_entries = fs::read_dir(&project_path).await
            .map_err(|e| format!("Failed to read project sessions: {}", e))?;

        while let Some(entry) = session_entries.next_entry().await
            .map_err(|e| format!("Failed to read session entry: {}", e))?
        {
            let session_file_path = entry.path();
            if let Some(filename) = session_file_path.file_name().and_then(|f| f.to_str()) {
                // Only load Claudio session files, skip native Claude sessions
                if filename.starts_with("claudio-") && filename.ends_with(".json") {
                    match fs::read_to_string(&session_file_path).await {
                        Ok(content) => {
                            match serde_json::from_str::<ClaudioSession>(&content) {
                                Ok(session) => {
                                    cache.insert(session.claudio_id.clone(), session);
                                    loaded_count += 1;
                                },
                                Err(e) => {
                                    log::warn!("Failed to parse Claudio session {}: {}", session_file_path.display(), e);
                                }
                            }
                        },
                        Err(e) => {
                            log::warn!("Failed to read Claudio session file {}: {}", session_file_path.display(), e);
                        }
                    }
                }
            }
        }
    }

    log::info!("Initialized Claudio cache with {} sessions", loaded_count);
    Ok(())
}

/// Create a new Claudio session or resume an existing Claude session
///
/// # Parameters
/// - `project_path`: Path to the project
/// - `session_id`: None for new session, Some(session_id) to resume existing Claude session
/// - `settings`: None to use defaults, Some(settings) to specify custom settings
///
/// # Returns
/// The claudio_id of the created session
#[command]
pub async fn create_claudio_session(
    project_path: String,
    session_id: Option<String>,
) -> Result<String, String> {
    ensure_claudio_dirs().await?;

    let claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());

    if let Some(ref sid) = session_id {
        log::info!("Resuming Claude session: {} as Claudio session: {}", sid, claudio_id);
    } else {
        log::debug!("Creating new Claudio session: {} for project: {}", claudio_id, project_path);
    };

    let new_session = ClaudioSession {
        claudio_id: claudio_id.clone(),
        project_path: project_path.clone(),
        current_session: if let Some(sid) = session_id.clone() {
            // When resuming, read the actual session file to get last message info
            match get_last_message_info(&project_path, &sid).await {
                Ok((uuid, timestamp)) => {
                    log::info!("Resuming session {} with last message UUID: {}", sid, uuid);
                    Some(SessionInfo {
                        session_id: sid,
                        last_message_uuid: uuid,
                        last_message_timestamp: timestamp,
                    })
                },
                Err(e) => {
                    log::error!("Cannot resume session {}: failed to read last message info: {}", sid, e);
                    return Err(format!("Cannot resume session {}: {}", sid, e));
                }
            }
        } else {
            None // New session, will be populated when turn completes
        },
        status: if session_id.is_some() {
            SessionStatus::Idle // Resumed sessions start as Idle until a turn begins
        } else {
            SessionStatus::Active // New sessions start as Active (turn will begin immediately)
        },
        session_history: Vec::new(), // Fresh wrapper, empty history for both new and resumed
    };

    // Put the session in memory immediately during creation
    {
        let mut sessions = CLAUDIO_SESSIONS.write().await;
        sessions.insert(claudio_id.clone(), new_session.clone());
        log::debug!("Added session to memory cache: {}", claudio_id);
    }

    // Persist to disk asynchronously
    let project_path_clone = project_path.clone();
    let updates_clone = new_session.clone();
    let claudio_id_clone = claudio_id.clone();
    tokio::spawn(async move {
        if let Err(e) = persist_session_to_disk(&claudio_id_clone, &project_path_clone, &updates_clone).await {
            log::error!("Failed to persist Claudio session to disk: {}", e);
        }
    });

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
        log::debug!("⚡ Updated Claudio session in memory: {}", claudio_session_id);
    }
    
    // 2. Persist to disk asynchronously (doesn't block)
    let project_path_clone = project_path.clone();
    let updates_clone = updates.clone();
    tokio::spawn(async move {
        if let Err(e) = persist_session_to_disk(&claudio_session_id, &project_path_clone, &updates_clone).await {
            log::error!("Failed to persist Claudio session to disk: {}", e);
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

/// Get session metadata (reads from in-memory cache)
#[command]
pub async fn get_claudio_session(
    claudio_session_id: String,
    _project_path: String, // Keep for API compatibility but not needed since cache is global
) -> Result<ClaudioSession, String> {
    let cache = CLAUDIO_SESSIONS.read().await;

    cache.get(&claudio_session_id)
        .cloned()
        .ok_or_else(|| format!("Claudio session not found: {}", claudio_session_id))
}

/// Find a Claudio session that has the given Claude session ID as its current_session
pub async fn find_claudio_session_by_current_session(
    project_path: &str,
    claude_session_id: &str
) -> Result<Option<ClaudioSession>, String> {
    let cache = CLAUDIO_SESSIONS.read().await;

    // Search through all sessions for the project
    for session in cache.values() {
        if session.project_path == project_path {
            if let Some(current_session) = &session.current_session {
                if current_session.session_id == claude_session_id {
                    return Ok(Some(session.clone()));
                }
            }
        }
    }

    Ok(None)
}

/// List all sessions for a project (reads from in-memory cache)
#[command]
pub async fn list_claudio_sessions(project_path: String) -> Result<Vec<ClaudioSession>, String> {
    let cache = CLAUDIO_SESSIONS.read().await;

    // Filter sessions by project path and collect into vector
    let mut sessions: Vec<ClaudioSession> = cache.values()
        .filter(|session| session.project_path == project_path)
        .cloned()
        .collect();

    // Sort by claudio_id (newest first - higher timestamp)
    sessions.sort_by(|a, b| b.claudio_id.cmp(&a.claudio_id));

    log::debug!("Listed {} Claudio sessions for project: {}", sessions.len(), project_path);
    Ok(sessions)
}


/// Delete a Claudio session wrapper
/// This removes the Claudio wrapper metadata, effectively archiving the session
/// while preserving the underlying Claude session JSONL file for history
#[command]
pub async fn delete_claudio_session(
    claudio_session_id: String,
    project_path: String,
) -> Result<serde_json::Value, String> {
    log::info!("🗑️ Deleting Claudio session: {}", claudio_session_id);

    // 1. Remove from in-memory cache first
    {
        let mut sessions = CLAUDIO_SESSIONS.write().await;
        if sessions.remove(&claudio_session_id).is_some() {
            log::debug!("⚡ Removed Claudio session from memory cache: {}", claudio_session_id);
        }
    }

    // 2. Remove the Claudio metadata file from disk
    let project_dir = get_project_claudio_dir(&project_path)?;
    let session_file = project_dir.join(format!("{}.json", claudio_session_id));

    if !session_file.exists() {
        return Err("Claudio session metadata file not found".to_string());
    }

    // Get file size for reporting
    let file_size = fs::metadata(&session_file).await
        .map_err(|e| format!("Failed to get session file metadata: {}", e))?
        .len();

    fs::remove_file(&session_file).await
        .map_err(|e| format!("Failed to delete Claudio session: {}", e))?;

    log::info!("✅ Successfully deleted Claudio session: {} ({:.2} KB freed)",
               claudio_session_id, file_size as f64 / 1024.0);

    Ok(serde_json::json!({
        "success": true,
        "claudio_session_id": claudio_session_id,
        "project_path": project_path,
        "size_freed_kb": file_size as f64 / 1024.0,
        "message": format!("Deleted Claudio session {}", claudio_session_id)
    }))
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
        log::debug!("Deleted Claude session: {}", claude_session_file.display());
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
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(session) = serde_json::from_str::<ClaudioSession>(&content) {
                            // Delete if this claudio session references the Claude session we're deleting
                            if let Some(ref current_session) = session.current_session {
                                if current_session.session_id == claude_session_id {
                                    if std::fs::remove_file(&path).is_ok() {
                                        claudio_files_deleted += 1;
                                        log::debug!("Deleted Claudio session: {}", path.display());
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
    log::info!("Starting orphaned files cleanup...");
    
    let mut stats = OrphanCleanupStats::default();
    
    // Get all projects
    let claude_dir = crate::commands::claude::get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");
    
    if !projects_dir.exists() {
        return Ok(stats.to_json());
    }

    // Build global list of existing sessions first
    let mut all_existing_sessions = std::collections::HashSet::new();
    if let Ok(project_entries) = std::fs::read_dir(&projects_dir) {
        for project_entry in project_entries.flatten() {
            let project_path = project_entry.path();
            if project_path.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&project_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                                all_existing_sessions.insert(session_id.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // Clean up orphaned todos ONCE globally
    stats.orphaned_todos = cleanup_global_orphaned_todos(&claude_dir, &all_existing_sessions)?;

    // For each project, find other orphans (claudio sessions and timelines)
    if let Ok(project_entries) = std::fs::read_dir(&projects_dir) {
        for project_entry in project_entries.flatten() {
            let project_path = project_entry.path();
            let project_id = project_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            
            if project_path.is_dir() {
                stats.merge(cleanup_project_orphans(&project_path, project_id, &all_existing_sessions).await?);
            }
        }
    }
    
    log::info!("Orphan cleanup complete: {}", stats.summary());
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

/// Clean up orphaned todos globally (called once, not per project)
fn cleanup_global_orphaned_todos(
    claude_dir: &std::path::Path,
    existing_sessions: &std::collections::HashSet<String>,
) -> Result<u32, String> {
    let mut todos_deleted = 0;
    let todos_dir = claude_dir.join("todos");
    
    if todos_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&todos_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                    if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                        // Extract session ID from agent todo filename pattern: {session_id}-agent-{agent_id}.json
                        let session_id = if let Some(dash_pos) = filename.find("-agent-") {
                            &filename[..dash_pos]
                        } else {
                            filename  // fallback for non-agent format
                        };
                        
                        if !existing_sessions.contains(session_id) {
                            // Orphaned todo - delete it
                            if std::fs::remove_file(&path).is_ok() {
                                todos_deleted += 1;
                                log::debug!("Deleted orphaned todo: {}", path.display());
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(todos_deleted)
}

async fn cleanup_project_orphans(
    project_path: &std::path::Path,
    project_id: &str,
    existing_sessions: &std::collections::HashSet<String>,
) -> Result<OrphanCleanupStats, String> {
    let mut stats = OrphanCleanupStats::default();
    stats.projects_processed = 1;
    
    // Decode project path for claudio directory lookup
    let decoded_project_path = crate::commands::claude::decode_project_path(project_id);
    
    // 1. Cleanup orphaned Claudio sessions
    if let Ok(claudio_dir) = get_project_claudio_dir(&decoded_project_path) {
        if claudio_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&claudio_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(session) = serde_json::from_str::<ClaudioSession>(&content) {
                                // Check if the referenced Claude session exists
                                if let Some(ref current_session) = session.current_session {
                                    if !existing_sessions.contains(&current_session.session_id) {
                                        // Orphaned claudio session - delete it
                                        if std::fs::remove_file(&path).is_ok() {
                                            stats.orphaned_claudio_sessions += 1;
                                            log::debug!("Deleted orphaned Claudio session: {}", path.display());
                                        }
                                    }
                                } else {
                                    // Claudio session with no Claude session reference - also orphaned
                                    if std::fs::remove_file(&path).is_ok() {
                                        stats.orphaned_claudio_sessions += 1;
                                        log::debug!("Deleted empty Claudio session: {}", path.display());
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
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                    if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                        // Extract session ID from agent todo filename pattern: {session_id}-agent-{agent_id}.json
                        let session_id = if let Some(dash_pos) = filename.find("-agent-") {
                            &filename[..dash_pos]
                        } else {
                            filename  // fallback for non-agent format (should not exist)
                        };
                        
                        if !existing_sessions.contains(session_id) {
                            // Orphaned todo - delete it
                            if std::fs::remove_file(&path).is_ok() {
                                stats.orphaned_todos += 1;
                                log::debug!("Deleted orphaned todo: {}", path.display());
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
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                    if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                        if !existing_sessions.contains(session_id) {
                            // Orphaned timeline - delete it
                            if std::fs::remove_file(&path).is_ok() {
                                stats.orphaned_timelines += 1;
                                log::debug!("Deleted orphaned timeline: {}", path.display());
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(stats)
}

/// Read the last message from a Claude session .jsonl file to get UUID and timestamp
async fn get_last_message_info(
    project_path: &str,
    session_id: &str
) -> Result<(String, chrono::DateTime<chrono::Utc>), String> {
    // Session files are stored in ~/.claude/projects/PROJECT_ID/session_id.jsonl
    let claude_dir = crate::commands::claude::get_claude_dir()
        .map_err(|e| format!("Failed to get Claude directory: {}", e.to_string()))?;

    // Encode project path to match Claude Code's format: replace "/" and spaces with "-"
    let project_encoded = project_path.replace("/", "-").replace("\\", "-").replace(" ", "-");

    let session_file_path = claude_dir
        .join("projects")
        .join(project_encoded)
        .join(format!("{}.jsonl", session_id));

    if !session_file_path.exists() {
        return Err(format!("Session file not found: {}", session_file_path.display()));
    }

    // Read the file line by line to get the last line
    let file = fs::File::open(&session_file_path).await
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut last_line = None;

    while let Some(line) = lines.next_line().await
        .map_err(|e| format!("Failed to read line: {}", e))? {
        if !line.trim().is_empty() {
            last_line = Some(line);
        }
    }

    let last_line = last_line.ok_or("Session file is empty")?;

    // Parse the last line as JSON to extract UUID and timestamp
    let message: serde_json::Value = serde_json::from_str(&last_line)
        .map_err(|e| format!("Failed to parse last message as JSON: {}", e))?;

    // Extract UUID
    let uuid = message.get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("Last message missing UUID field")?
        .to_string();

    // Extract timestamp
    let timestamp_str = message.get("timestamp")
        .and_then(|v| v.as_str())
        .ok_or("Last message missing timestamp field")?;

    let timestamp = chrono::DateTime::parse_from_rfc3339(timestamp_str)
        .map_err(|e| format!("Failed to parse timestamp: {}", e))?
        .with_timezone(&chrono::Utc);

    Ok((uuid, timestamp))
}

