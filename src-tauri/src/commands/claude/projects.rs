use super::types::*;
use std::fs;
use std::time::SystemTime;
use tauri::command;

/// Count local agents in a project's .claude/agents directory
fn count_project_agents(project_path: &str) -> Option<u32> {
    let agents_dir = std::path::PathBuf::from(project_path).join(".claude").join("agents");
    
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

/// Lists all Claude projects from ~/.claude/projects directory
#[command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    log::info!("Listing projects from ~/.claude/projects");

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        log::warn!("Projects directory does not exist: {:?}", projects_dir);
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    // Read all directories in the projects folder
    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid directory name".to_string())?;

            // Skip hidden directories (starting with .)
            if dir_name.starts_with('.') {
                log::debug!("Skipping hidden directory: {}", dir_name);
                continue;
            }

            // Get directory creation time
            let metadata = fs::metadata(&path)
                .map_err(|e| format!("Failed to read directory metadata: {}", e))?;

            let created_at = metadata
                .created()
                .or_else(|_| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Get the actual project path from JSONL files
            let project_path = match get_project_path_from_sessions(&path) {
                Ok(path) => path,
                Err(e) => {
                    log::warn!("Failed to get project path from sessions for {}: {}, falling back to decode", dir_name, e);
                    decode_project_path(dir_name)
                }
            };

            // List all JSONL files (sessions) in this project directory
            let mut sessions = Vec::new();
            let mut project_total_size = 0u64;
            let mut project_total_tokens = 0u64;
            let mut project_total_cost = 0.0f64;
            let mut project_last_active = created_at;
            
            if let Ok(session_entries) = fs::read_dir(&path) {
                for session_entry in session_entries.flatten() {
                    let session_path = session_entry.path();
                    if session_path.is_file()
                        && session_path.extension().and_then(|s| s.to_str()) == Some("jsonl")
                    {
                        if let Some(session_id) = session_path.file_stem().and_then(|s| s.to_str())
                        {
                            sessions.push(session_id.to_string());
                            
                            // Add file size
                            if let Ok(metadata) = fs::metadata(&session_path) {
                                project_total_size += metadata.len();
                                
                                // Update last activity time
                                let file_time = metadata
                                    .modified()
                                    .or_else(|_| metadata.created())
                                    .unwrap_or(SystemTime::UNIX_EPOCH)
                                    .duration_since(SystemTime::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs();
                                
                                if file_time > project_last_active {
                                    project_last_active = file_time;
                                }
                            }
                            
                            // Parse session analytics
                            let analytics = parse_session_analytics(&session_path);
                            project_total_tokens += analytics.token_count;
                            project_total_cost += analytics.cost_usd;
                        }
                    }
                }
            }

            projects.push(Project {
                id: dir_name.to_string(),
                path: project_path.clone(),
                sessions,
                created_at,
                total_size_bytes: if project_total_size > 0 { Some(project_total_size) } else { None },
                last_active: if project_last_active > created_at { Some(project_last_active) } else { None },
                total_tokens: if project_total_tokens > 0 { Some(project_total_tokens) } else { None },
                total_cost_usd: if project_total_cost > 0.0 { Some(project_total_cost) } else { None },
                agent_count: count_project_agents(&project_path),
            });
        }
    }

    // Sort projects by last activity time (most recent first)
    projects.sort_by(|a, b| b.last_active.cmp(&a.last_active));

    log::info!("Found {} projects", projects.len());
    Ok(projects)
}

/// Deletes an entire Claude project and all its sessions and associated data
#[command]
pub async fn delete_claude_project(project_id: String) -> Result<serde_json::Value, String> {
    log::info!("Deleting Claude project: {}", project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Collect all session IDs before deletion for cleanup
    let mut session_ids = Vec::new();
    let mut session_count = 0;
    
    if let Ok(entries) = fs::read_dir(&project_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension().and_then(|ext| ext.to_str()) {
                if ext == "jsonl" {
                    if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                        session_ids.push(session_id.to_string());
                        session_count += 1;
                    }
                }
            }
        }
    }
    
    // Calculate total size before deletion
    let total_size = calculate_directory_size(&project_dir)?;
    
    // Clean up associated files for each session
    let todos_dir = claude_dir.join("todos");
    let mut todos_deleted = 0;
    let mut timelines_deleted = 0;
    
    for session_id in &session_ids {
        // Delete all agent todo files for this session (pattern: {session-id}-agent-*.json)
        if todos_dir.exists() {
            if let Ok(todo_entries) = fs::read_dir(&todos_dir) {
                for todo_entry in todo_entries.flatten() {
                    let file_name = todo_entry.file_name().to_string_lossy().to_string();
                    if file_name.starts_with(&format!("{}-agent-", session_id)) && file_name.ends_with(".json") {
                        if let Err(e) = fs::remove_file(todo_entry.path()) {
                            log::warn!("Failed to delete todo file '{}': {}", file_name, e);
                        } else {
                            todos_deleted += 1;
                            log::debug!("Deleted todo file: {}", file_name);
                        }
                    }
                }
            }
        }
        
        // Delete timeline directory for this session
        let timeline_dir = project_dir.join(".timelines").join(session_id);
        if timeline_dir.exists() {
            if let Err(e) = fs::remove_dir_all(&timeline_dir) {
                log::warn!("Failed to delete timeline directory for session '{}': {}", session_id, e);
            } else {
                timelines_deleted += 1;
                log::debug!("Deleted timeline directory for session: {}", session_id);
            }
        }
    }
    
    // Delete the entire project directory (this removes sessions, timelines directory, etc.)
    fs::remove_dir_all(&project_dir)
        .map_err(|e| format!("Failed to delete project directory: {}", e))?;
    
    log::info!("Successfully deleted project '{}' with {} sessions, {} todo files, {} timelines ({:.2} MB)", 
               project_id, session_count, todos_deleted, timelines_deleted, total_size as f64 / 1024.0 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "project_id": project_id,
        "sessions_deleted": session_count,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "size_mb": total_size as f64 / 1024.0 / 1024.0,
        "message": format!("Deleted project with {} sessions, {} todos, {} timelines", session_count, todos_deleted, timelines_deleted)
    }))
}