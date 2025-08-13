use super::types::*;
use notify::{Watcher, RecursiveMode, Event, EventKind, RecommendedWatcher};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use tauri::{command, AppHandle, State, Emitter};
use tokio::sync::broadcast;
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
            return Err(format!("Project sessions directory not found: {}", project_id));
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

    /// Get a receiver for session file events
    pub fn subscribe(&self) -> broadcast::Receiver<SessionFileEvent> {
        self.event_sender.subscribe()
    }

    /// Handle file system events and emit session file events
    async fn handle_file_events(
        rx: mpsc::Receiver<SessionFileEvent>,
        event_sender: broadcast::Sender<SessionFileEvent>,
        app_handle: AppHandle,
    ) {
        for session_event in rx {
            // Send event via broadcast channel
            if let Err(e) = event_sender.send(session_event.clone()) {
                log::error!("Failed to send session event via broadcast: {}", e);
            }

            // Also emit as Tauri event to frontend
            if let Err(e) = app_handle.emit("session-file-changed", &session_event) {
                log::error!("Failed to emit session file event: {}", e);
            }
        }
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
        manager.start_watching_project(&project_id)
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