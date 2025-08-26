use crate::commands::claude::get_claude_dir;
use notify::{Watcher, RecursiveMode, Event, EventKind, RecommendedWatcher};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use tauri::{command, AppHandle, State, Emitter};
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};
use serde::{Deserialize, Serialize};

/// Event types for session file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SessionFileEvent {
    /// Session file was modified (updated with new messages)
    Modified {
        session_id: String,
        project_id: String,
        file_path: String,
        modified_at: u64,
    },
    /// Session file was created (new session started)
    Created {
        session_id: String,
        project_id: String,
        file_path: String,
        created_at: u64,
    },
    /// Session file was removed (session deleted)
    Removed {
        session_id: String,
        project_id: String,
        file_path: String,
    },
}

impl SessionFileEvent {
    /// Get the project ID for this event
    pub fn get_project_id(&self) -> &str {
        match self {
            SessionFileEvent::Modified { project_id, .. } => project_id,
            SessionFileEvent::Created { project_id, .. } => project_id,
            SessionFileEvent::Removed { project_id, .. } => project_id,
        }
    }
    
    /// Get the session ID for this event
    pub fn get_session_id(&self) -> &str {
        match self {
            SessionFileEvent::Modified { session_id, .. } => session_id,
            SessionFileEvent::Created { session_id, .. } => session_id,
            SessionFileEvent::Removed { session_id, .. } => session_id,
        }
    }
}

/// Manages session file watchers for multiple projects
pub struct SessionWatcherManager {
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
    event_sender: broadcast::Sender<SessionFileEvent>,
    app_handle: AppHandle,
}

/// Global state for session file watchers
pub type SessionWatcherState = Arc<Mutex<Option<SessionWatcherManager>>>;

impl SessionWatcherManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, _rx) = broadcast::channel(100); // Buffer up to 100 events
        
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            event_sender: tx,
            app_handle,
        }
    }

    /// Start watching session files for a specific project
    pub fn start_watching_project(&self, project_id: &str) -> Result<(), String> {
        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let project_sessions_dir = claude_dir.join("projects").join(project_id);
        
        if !project_sessions_dir.exists() {
            // Create the directory if it doesn't exist - this happens for brand new projects
            std::fs::create_dir_all(&project_sessions_dir)
                .map_err(|e| format!("Failed to create project sessions directory: {}", e))?;
            log::info!("Created project sessions directory: {:?}", project_sessions_dir);
        }

        let mut watchers = self.watchers.lock().map_err(|e| format!("Lock error: {}", e))?;
        
        // Don't create duplicate watchers
        if watchers.contains_key(project_id) {
            log::debug!("Already watching project: {}", project_id);
            return Ok(());
        }

        let (tx, rx) = mpsc::channel();
        let project_id_clone = project_id.to_string();
        let event_sender = self.event_sender.clone();
        let app_handle = self.app_handle.clone();

        let mut watcher = RecommendedWatcher::new(
            move |result: Result<Event, notify::Error>| {
                if let Ok(event) = result {
                    if let Some(session_event) = Self::create_session_event_from_notify(&event, &project_id_clone) {
                        // Send via mpsc channel for async processing
                        let _ = tx.send(session_event);
                    }
                }
            },
            notify::Config::default(),
        ).map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher.watch(&project_sessions_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to start watching directory: {}", e))?;

        // Spawn async task to handle file events
        tokio::spawn(async move {
            Self::handle_file_events(rx, event_sender, app_handle).await;
        });

        watchers.insert(project_id.to_string(), watcher);
        log::info!("Started watching session files for project: {}", project_id);
        
        Ok(())
    }

    /// Stop watching session files for a specific project
    pub fn stop_watching_project(&self, project_id: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|e| format!("Lock error: {}", e))?;
        
        if let Some(_watcher) = watchers.remove(project_id) {
            log::info!("Stopped watching session files for project: {}", project_id);
            Ok(())
        } else {
            Err(format!("No watcher found for project: {}", project_id))
        }
    }

    /// Stop watching all projects
    pub fn stop_all_watchers(&self) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|e| format!("Lock error: {}", e))?;
        let project_ids: Vec<String> = watchers.keys().cloned().collect();
        
        for project_id in project_ids {
            watchers.remove(&project_id);
            log::info!("Stopped watching session files for project: {}", project_id);
        }
        
        Ok(())
    }


    /// Handle file system events with 5-second debouncing and emit session file events
    async fn handle_file_events(
        rx: mpsc::Receiver<SessionFileEvent>,
        event_sender: broadcast::Sender<SessionFileEvent>,
        app_handle: AppHandle,
    ) {
        use std::sync::Arc;
        use std::sync::Mutex as StdMutex;
        
        let debounce_duration = Duration::from_millis(100); // Minimal debounce for file system events
        let pending_timers: Arc<StdMutex<HashMap<String, tokio::task::JoinHandle<()>>>> = Arc::new(StdMutex::new(HashMap::new()));
        
        // Use blocking task to handle the synchronous receiver
        tokio::task::spawn_blocking(move || {
            let rt = tokio::runtime::Handle::current();
            
            // Process events as they come in
            for session_event in rx {
                let key = format!("{}:{}", session_event.get_project_id(), session_event.get_session_id());
                log::debug!("Received session event for debouncing: {} ({})", key, session_event.get_session_id());
                
                rt.block_on(async {
                    // Cancel any existing timer for this session
                    if let Ok(mut timers) = pending_timers.lock() {
                        if let Some(existing_timer) = timers.remove(&key) {
                            existing_timer.abort();
                            log::debug!("Cancelled existing debounce timer for {}", key);
                        }
                    }
                    
                    // Start a new debounce timer for this specific event
                    let event_sender_clone = event_sender.clone();
                    let app_handle_clone = app_handle.clone();
                    let pending_timers_clone = pending_timers.clone();
                    let key_clone = key.clone();
                    
                    let timer_handle = tokio::spawn(async move {
                        sleep(debounce_duration).await;
                        
                        // Remove ourselves from pending timers
                        if let Ok(mut timers) = pending_timers_clone.lock() {
                            timers.remove(&key_clone);
                        }
                        
                        // After debounce period, check for session cleanup opportunities
                        if let SessionFileEvent::Modified { session_id, project_id, .. } = &session_event {
                            log::info!("🔍 Checking session {} in project {} for cleanup opportunities", session_id, project_id);
                            if let Err(e) = Self::check_and_cleanup_previous_sessions(session_id, project_id).await {
                                log::error!("Failed to cleanup previous sessions: {}", e);
                            }
                        }
                        
                        // After debounce period, emit the event
                        log::info!("📁 Emitting debounced session file change: {} in project {}", 
                                   session_event.get_session_id(), session_event.get_project_id());
                        
                        // Send event via broadcast channel
                        if let Err(e) = event_sender_clone.send(session_event.clone()) {
                            log::error!("Failed to send session event via broadcast: {}", e);
                        }

                        // Also emit as Tauri event to frontend
                        if let Err(e) = app_handle_clone.emit("session-file-changed", &session_event) {
                            log::error!("Failed to emit session file event: {}", e);
                        }
                    });
                    
                    // Store the timer handle
                    if let Ok(mut timers) = pending_timers.lock() {
                        timers.insert(key, timer_handle);
                    }
                });
            }
            
            log::info!("Session file event handler terminated");
        }).await.unwrap_or_else(|e| {
            log::error!("Session file event handler task failed: {:?}", e);
        });
    }

    /// Create a SessionFileEvent from a notify Event (new API)
    fn create_session_event_from_notify(
        event: &Event,
        project_id: &str,
    ) -> Option<SessionFileEvent> {
        let path = event.paths.first()?;
        
        // Only handle .jsonl files
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
            return None;
        }

        let session_id = path.file_stem()?.to_str()?.to_string();
        let file_path = path.to_string_lossy().to_string();

        match &event.kind {
            EventKind::Create(_) => {
                let created_at = std::fs::metadata(path)
                    .and_then(|meta| meta.created())
                    .or_else(|_| std::fs::metadata(path).and_then(|meta| meta.modified()))
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                Some(SessionFileEvent::Created {
                    session_id,
                    project_id: project_id.to_string(),
                    file_path,
                    created_at,
                })
            }
            EventKind::Modify(_) => {
                let modified_at = std::fs::metadata(path)
                    .and_then(|meta| meta.modified())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                Some(SessionFileEvent::Modified {
                    session_id,
                    project_id: project_id.to_string(),
                    file_path,
                    modified_at,
                })
            }
            EventKind::Remove(_) => {
                Some(SessionFileEvent::Removed {
                    session_id,
                    project_id: project_id.to_string(),
                    file_path,
                })
            }
            _ => None,
        }
    }

    /// Check if current session contains last_message_uuid from claudio metadata and cleanup previous sessions
    async fn check_and_cleanup_previous_sessions(session_id: &str, project_id: &str) -> Result<(), String> {
        use crate::commands::claudio_storage::{list_claudio_sessions, cleanup_session_files};
        
        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let session_file_path = claude_dir
            .join("projects")
            .join(project_id)
            .join(format!("{}.jsonl", session_id));

        // Read the current session file to get the last message UUID
        let session_content = std::fs::read_to_string(&session_file_path)
            .map_err(|e| format!("Failed to read session file: {}", e))?;
        
        // Extract all UUIDs from the current session file
        let mut current_session_uuids = std::collections::HashSet::new();
        for line in session_content.lines() {
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(uuid) = message["uuid"].as_str() {
                    current_session_uuids.insert(uuid.to_string());
                }
            }
        }
        
        // Reconstruct project path from project_id
        let project_path = project_id.replace("-", "/");
        
        // Find claudio sessions for this project
        let claudio_sessions = list_claudio_sessions(project_path.clone()).await?;
        
        for claudio_session in claudio_sessions {
            // Check if this claudio session's last_message_uuid appears in the current session
            if let Some(last_msg_uuid) = &claudio_session.last_message_uuid {
                if current_session_uuids.contains(last_msg_uuid) {
                    log::info!("🧹 Detected UUID {} from previous session appearing in current session {} for claudio session: {}", 
                              last_msg_uuid, session_id, claudio_session.claudio_id);
                    
                    // Clean up sessions from history that are not the current session
                    let mut cleaned_sessions = Vec::new();
                    for historical_session_id in &claudio_session.session_history {
                        if historical_session_id != session_id {
                            match cleanup_session_files(&project_path, historical_session_id).await {
                                Ok((claude_files, claudio_files)) => {
                                    log::info!("🗑️  Cleaned up historical session {}: {} claude files, {} claudio files", 
                                              historical_session_id, claude_files, claudio_files);
                                    cleaned_sessions.push(historical_session_id.clone());
                                },
                                Err(e) => {
                                    log::error!("Failed to cleanup historical session {}: {}", historical_session_id, e);
                                }
                            }
                        }
                    }
                    
                    // Keep session history as a record - don't remove cleaned sessions
                    
                    // Keep the last_message_uuid and session_history as permanent records
                    log::info!("✅ Cleaned up historical sessions for claudio session: {}", claudio_session.claudio_id);
                    
                    break; // Found the matching claudio session, no need to continue
                }
            }
        }
        
        Ok(())
    }
}

/// Initialize the session watcher manager
pub fn init_session_watcher(app_handle: AppHandle) -> SessionWatcherState {
    let manager = SessionWatcherManager::new(app_handle);
    Arc::new(Mutex::new(Some(manager)))
}

/// Start watching session files for a project
#[command]
pub async fn start_session_watching(
    project_id: String,
    state: State<'_, SessionWatcherState>,
) -> Result<(), String> {
    let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = state_guard.as_ref() {
        let result = manager.start_watching_project(&project_id);
        
        // File watcher started successfully, history will be loaded when files are actually modified
        
        result
    } else {
        Err("Session watcher manager not initialized".to_string())
    }
}

/// Stop watching session files for a project
#[command]
pub async fn stop_session_watching(
    project_id: String,
    state: State<'_, SessionWatcherState>,
) -> Result<(), String> {
    let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = state_guard.as_ref() {
        manager.stop_watching_project(&project_id)
    } else {
        Err("Session watcher manager not initialized".to_string())
    }
}

/// Stop watching all session files
#[command]
pub async fn stop_all_session_watching(
    state: State<'_, SessionWatcherState>,
) -> Result<(), String> {
    let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = state_guard.as_ref() {
        manager.stop_all_watchers()
    } else {
        Err("Session watcher manager not initialized".to_string())
    }
}

/// Get the current status of session watchers
#[command]
pub async fn get_session_watching_status(
    state: State<'_, SessionWatcherState>,
) -> Result<Vec<String>, String> {
    let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    if let Some(manager) = state_guard.as_ref() {
        let watchers = manager.watchers.lock().map_err(|e| format!("Lock error: {}", e))?;
        Ok(watchers.keys().cloned().collect())
    } else {
        Err("Session watcher manager not initialized".to_string())
    }
}