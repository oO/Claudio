use super::types::*;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::{SystemTime, Duration, UNIX_EPOCH};
use tauri::command;
use serde::{Deserialize, Serialize};

/// Gets sessions for a specific project
#[command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<Session>, String> {
    log::info!("Getting sessions for project: {}", project_id);

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let todos_dir = claude_dir.join("todos");

    if !project_dir.exists() {
        return Err(format!("Project directory not found: {}", project_id));
    }

    // Get the actual project path from JSONL files
    let project_path = match get_project_path_from_sessions(&project_dir) {
        Ok(path) => path,
        Err(e) => {
            log::warn!(
                "Failed to get project path from sessions for {}: {}, falling back to decode",
                project_id,
                e
            );
            decode_project_path(&project_id)
        }
    };

    let mut sessions = Vec::new();

    // Read all JSONL files in the project directory
    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                // Get file creation time
                let metadata = fs::metadata(&path)
                    .map_err(|e| format!("Failed to read file metadata: {}", e))?;

                let created_at = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                // Extract first user message and timestamp
                let (first_message, message_timestamp) = extract_first_user_message(&path);

                // Try to load associated todo data
                let todo_path = todos_dir.join(format!("{}.json", session_id));
                let todo_data = if todo_path.exists() {
                    fs::read_to_string(&todo_path)
                        .ok()
                        .and_then(|content| serde_json::from_str(&content).ok())
                } else {
                    None
                };

                // Parse session analytics
                let analytics = parse_session_analytics(&path);
                let file_size = metadata.len();

                // Aggregate todo counts from agent executions
                let todo_counts = aggregate_session_todos(&claude_dir, &session_id);

                sessions.push(Session {
                    id: session_id.to_string(),
                    project_id: project_id.clone(),
                    project_path: project_path.clone(),
                    todo_data,
                    todo_counts,
                    created_at,
                    first_message,
                    message_timestamp,
                    size_bytes: Some(file_size),
                    token_count: if analytics.token_count > 0 { Some(analytics.token_count) } else { None },
                    cost_usd: if analytics.cost_usd > 0.0 { Some(analytics.cost_usd) } else { None },
                    message_count: if analytics.message_count > 0 { Some(analytics.message_count) } else { None },
                });
            }
        }
    }

    // Sort sessions by creation time (newest first)
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    log::info!(
        "Found {} sessions for project {}",
        sessions.len(),
        project_id
    );
    Ok(sessions)
}

/// Loads the JSONL history for a specific session
#[command]
pub async fn load_session_history(
    session_id: String,
    project_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!(
        "Loading session history for session: {} in project: {}",
        session_id,
        project_id
    );

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    if !session_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    let file =
        fs::File::open(&session_path).map_err(|e| format!("Failed to open session file: {}", e))?;

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
}

/// Track session messages from the frontend for checkpointing
#[command]
pub async fn track_session_messages(
    state: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    messages: Vec<String>,
) -> Result<(), String> {
    log::info!(
        "Tracking {} messages for session {}",
        messages.len(),
        session_id
    );

    let manager = state
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    for message in messages {
        manager
            .track_message(message)
            .await
            .map_err(|e| format!("Failed to track message: {}", e))?;
    }

    Ok(())
}

/// Deletes a specific session from a project and all associated data
#[command]
pub async fn delete_session(project_id: String, session_id: String) -> Result<serde_json::Value, String> {
    log::info!("Deleting session '{}' from project '{}'", session_id, project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let session_file = project_dir.join(format!("{}.jsonl", session_id));
    
    if !session_file.exists() {
        return Err(format!("Session '{}' not found in project '{}'", session_id, project_id));
    }
    
    // Get file size before deletion
    let file_size = fs::metadata(&session_file)
        .map_err(|e| format!("Failed to get session file metadata: {}", e))?
        .len();
    
    // Delete the session file
    fs::remove_file(&session_file)
        .map_err(|e| format!("Failed to delete session file: {}", e))?;
    
    // Clean up associated files using shared function
    let (todos_deleted, timelines_deleted) = super::projects::delete_session_dependencies(&claude_dir, &project_dir, &session_id);
    
    // Note: Statsig files don't appear to be session-specific based on file structure analysis
    // They seem to be global cache files, so we don't delete them
    
    log::info!("Successfully deleted session '{}' with {} todos, {} timelines ({:.2} KB)", 
               session_id, todos_deleted, timelines_deleted, file_size as f64 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "session_id": session_id,
        "project_id": project_id,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "size_kb": file_size as f64 / 1024.0,
        "message": format!("Deleted session {} with {} todos, {} timelines", session_id, todos_deleted, timelines_deleted)
    }))
}

/// Prunes old sessions based on age and minimum count to keep
#[command]
pub async fn prune_old_sessions(
    project_id: Option<String>,
    days_old: u32,
    keep_min: usize,
) -> Result<serde_json::Value, String> {
    log::info!("Pruning sessions older than {} days, keeping at least {} sessions", days_old, keep_min);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");
    
    let mut total_deleted = 0;
    let mut total_size_freed = 0u64;
    let mut projects_processed = Vec::new();
    
    let cutoff_time = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() - (days_old as u64 * 24 * 60 * 60);
    
    // Determine which projects to process
    let projects_to_process = if let Some(specific_project) = project_id {
        vec![specific_project]
    } else {
        // Get all project IDs
        fs::read_dir(&projects_dir)
            .map_err(|e| format!("Failed to read projects directory: {}", e))?
            .filter_map(|entry| {
                entry.ok()
                    .filter(|e| e.path().is_dir())
                    .and_then(|e| e.file_name().to_str().map(|s| s.to_string()))
            })
            .collect()
    };
    
    for project_id in projects_to_process {
        let project_dir = projects_dir.join(&project_id);
        if !project_dir.exists() {
            continue;
        }
        
        // Get all session files with metadata
        let mut sessions = Vec::new();
        let entries = fs::read_dir(&project_dir)
            .map_err(|e| format!("Failed to read project directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    let metadata = fs::metadata(&path)
                        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
                    
                    let modified_time = metadata
                        .modified()
                        .or_else(|_| metadata.created())
                        .unwrap_or(SystemTime::UNIX_EPOCH)
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    
                    sessions.push((session_id.to_string(), path, modified_time, metadata.len()));
                }
            }
        }
        
        // Sort by modification time (newest first)
        sessions.sort_by(|a, b| b.2.cmp(&a.2));
        
        // Keep at least keep_min sessions, delete the rest if they're old enough
        let mut deleted_count = 0;
        let mut freed_size = 0u64;
        
        for (i, (session_id, path, modified_time, size)) in sessions.iter().enumerate() {
            // Skip if we need to keep minimum sessions
            if i < keep_min {
                continue;
            }
            
            // Delete if old enough
            if *modified_time < cutoff_time {
                fs::remove_file(path)
                    .map_err(|e| format!("Failed to delete session file: {}", e))?;
                
                // Also try to delete associated todo file
                let todo_file = claude_dir.join("todos").join(format!("{}.json", session_id));
                if todo_file.exists() {
                    let _ = fs::remove_file(&todo_file);
                }
                
                deleted_count += 1;
                freed_size += size;
                log::info!("Deleted old session '{}' from project '{}'", session_id, project_id);
            }
        }
        
        if deleted_count > 0 {
            projects_processed.push(serde_json::json!({
                "project_id": project_id,
                "sessions_deleted": deleted_count,
                "size_freed_mb": freed_size as f64 / 1024.0 / 1024.0
            }));
            
            total_deleted += deleted_count;
            total_size_freed += freed_size;
        }
    }
    
    log::info!("Pruning complete: deleted {} sessions, freed {:.2} MB", 
               total_deleted, total_size_freed as f64 / 1024.0 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "total_sessions_deleted": total_deleted,
        "total_size_freed_mb": total_size_freed as f64 / 1024.0 / 1024.0,
        "projects_processed": projects_processed,
        "message": format!("Deleted {} old sessions", total_deleted)
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionDeletionPreview {
    pub sessions_to_delete: Vec<Session>,
    pub sessions_to_keep: Vec<Session>,
    pub total_sessions: usize,
    pub sessions_to_delete_count: usize,
    pub sessions_to_keep_count: usize,
    pub size_to_free_mb: f64,
}

/// Gets a preview of sessions that would be deleted based on age threshold
#[command]
pub async fn preview_session_deletion_by_age(
    project_id: String,
    days_old: u64
) -> Result<SessionDeletionPreview, String> {
    log::info!("Previewing session deletion for project '{}' older than {} days", project_id, days_old);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get all sessions for the project
    let all_sessions = get_project_sessions(project_id.clone()).await?;
    
    // Calculate the cutoff timestamp
    let cutoff_duration = Duration::from_secs(days_old * 24 * 60 * 60);
    let cutoff_timestamp = SystemTime::now()
        .checked_sub(cutoff_duration)
        .ok_or("Invalid duration")?;
    
    let mut sessions_to_delete = Vec::new();
    let mut sessions_to_keep = Vec::new();
    let mut size_to_free = 0u64;
    
    for session in all_sessions {
        // Get the actual file modification time
        let session_file = project_dir.join(format!("{}.jsonl", session.id));
        if let Ok(metadata) = session_file.metadata() {
            if let Ok(modified_time) = metadata.modified() {
                if modified_time < cutoff_timestamp {
                    size_to_free += session.size_bytes.unwrap_or(0);
                    sessions_to_delete.push(session);
                } else {
                    sessions_to_keep.push(session);
                }
            } else {
                // If we can't get modified time, use created_at as fallback
                let created_time = UNIX_EPOCH + Duration::from_secs(session.created_at);
                if created_time < cutoff_timestamp {
                    size_to_free += session.size_bytes.unwrap_or(0);
                    sessions_to_delete.push(session);
                } else {
                    sessions_to_keep.push(session);
                }
            }
        }
    }
    
    // Sort sessions by created_at (oldest first for deletion, newest first for keeping)
    sessions_to_delete.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    sessions_to_keep.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(SessionDeletionPreview {
        total_sessions: sessions_to_delete.len() + sessions_to_keep.len(),
        sessions_to_delete_count: sessions_to_delete.len(),
        sessions_to_keep_count: sessions_to_keep.len(),
        sessions_to_delete,
        sessions_to_keep,
        size_to_free_mb: size_to_free as f64 / 1024.0 / 1024.0,
    })
}

/// Deletes sessions older than specified days for a project
#[command]
pub async fn delete_sessions_by_age(
    project_id: String,
    days_old: u64
) -> Result<serde_json::Value, String> {
    log::info!("Deleting sessions for project '{}' older than {} days", project_id, days_old);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get preview to know what will be deleted
    let preview = preview_session_deletion_by_age(project_id.clone(), days_old).await?;
    
    let mut sessions_deleted = 0;
    let mut todos_deleted = 0;
    let mut timelines_deleted = 0;
    
    // Delete each session and its dependencies
    for session in &preview.sessions_to_delete {
        // Delete the session file
        let session_file = project_dir.join(format!("{}.jsonl", session.id));
        if session_file.exists() {
            if let Err(e) = fs::remove_file(&session_file) {
                log::warn!("Failed to delete session file '{}': {}", session_file.display(), e);
                continue;
            }
            sessions_deleted += 1;
        }
        
        // Delete session dependencies using shared function
        let (session_todos, session_timelines) = super::projects::delete_session_dependencies(
            &claude_dir, &project_dir, &session.id
        );
        todos_deleted += session_todos;
        timelines_deleted += session_timelines;
    }
    
    log::info!(
        "Successfully deleted {} sessions, {} todos, {} timelines for project '{}' ({:.2} MB freed)",
        sessions_deleted, todos_deleted, timelines_deleted, project_id, preview.size_to_free_mb
    );
    
    Ok(serde_json::json!({
        "success": true,
        "project_id": project_id,
        "sessions_deleted": sessions_deleted,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "sessions_remaining": preview.sessions_to_keep_count,
        "size_freed_mb": preview.size_to_free_mb,
        "days_old": days_old,
        "message": format!(
            "Deleted {} sessions older than {} days ({} remaining)", 
            sessions_deleted, days_old, preview.sessions_to_keep_count
        )
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionAgeRange {
    pub newest_age_days: u64,
    pub oldest_age_days: u64,
    pub total_sessions: usize,
    pub has_sessions: bool,
}

/// Gets the age range of sessions in a project (newest to oldest in days)
#[command]
pub async fn get_session_age_range(project_id: String) -> Result<SessionAgeRange, String> {
    log::info!("Getting session age range for project '{}'", project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get all sessions for the project
    let all_sessions = get_project_sessions(project_id.clone()).await?;
    
    if all_sessions.is_empty() {
        return Ok(SessionAgeRange {
            newest_age_days: 0,
            oldest_age_days: 0,
            total_sessions: 0,
            has_sessions: false,
        });
    }
    
    let now = SystemTime::now();
    let mut newest_time: Option<SystemTime> = None;
    let mut oldest_time: Option<SystemTime> = None;
    
    for session in &all_sessions {
        // Get the actual file modification time
        let session_file = project_dir.join(format!("{}.jsonl", session.id));
        let session_time = if let Ok(metadata) = session_file.metadata() {
            if let Ok(modified_time) = metadata.modified() {
                modified_time
            } else {
                // If we can't get modified time, use created_at as fallback
                UNIX_EPOCH + Duration::from_secs(session.created_at)
            }
        } else {
            // If file doesn't exist, use created_at as fallback
            UNIX_EPOCH + Duration::from_secs(session.created_at)
        };
        
        match (newest_time, oldest_time) {
            (None, None) => {
                newest_time = Some(session_time);
                oldest_time = Some(session_time);
            },
            (Some(newest), Some(oldest)) => {
                if session_time > newest {
                    newest_time = Some(session_time);
                }
                if session_time < oldest {
                    oldest_time = Some(session_time);
                }
            },
            _ => unreachable!(),
        }
    }
    
    let newest_age_days = if let Some(newest) = newest_time {
        now.duration_since(newest)
            .unwrap_or(Duration::from_secs(0))
            .as_secs() / (24 * 60 * 60)
    } else {
        0
    };
    
    let oldest_age_days = if let Some(oldest) = oldest_time {
        now.duration_since(oldest)
            .unwrap_or(Duration::from_secs(0))
            .as_secs() / (24 * 60 * 60)
    } else {
        0
    };
    
    Ok(SessionAgeRange {
        newest_age_days,
        oldest_age_days: oldest_age_days.max(1), // Ensure at least 1 day minimum
        total_sessions: all_sessions.len(),
        has_sessions: true,
    })
}