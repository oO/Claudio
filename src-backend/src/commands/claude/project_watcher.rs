use crate::commands::claude::get_claude_dir;
use notify::{Watcher, RecursiveMode, Event, EventKind, RecommendedWatcher};
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use tauri::{command, AppHandle, State, Emitter};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};

/// Event types for project directory changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ProjectFileEvent {
    /// Project directory was created (new project)
    ProjectAdded {
        project_id: String,
    },
    /// Project directory was removed (project deleted)
    ProjectRemoved {
        project_id: String,
    },
    /// Session file was added/removed/modified in a project
    ProjectModified {
        project_id: String,
    },
}


/// Manages project file watchers
pub struct ProjectWatcherManager {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    event_sender: broadcast::Sender<ProjectFileEvent>,
    app_handle: AppHandle,
}

/// Global state for project file watcher
pub type ProjectWatcherState = Arc<Mutex<Option<ProjectWatcherManager>>>;

impl ProjectWatcherManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, _rx) = broadcast::channel(50); // Buffer up to 50 events
        
        Self {
            watcher: Arc::new(Mutex::new(None)),
            event_sender: tx,
            app_handle,
        }
    }

    /// Start watching the projects directory
    pub fn start_watching(&self) -> Result<(), String> {
        let mut watcher_opt = self.watcher.lock().map_err(|e| format!("Lock error: {}", e))?;
        
        // Don't create duplicate watchers
        if watcher_opt.is_some() {
            // Silently return - idempotent functions don't announce they're already done
            return Ok(());
        }

        // Setup directory to watch
        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let projects_dir = claude_dir.join("projects");
        
        // Create projects directory if it doesn't exist
        if !projects_dir.exists() {
            std::fs::create_dir_all(&projects_dir)
                .map_err(|e| format!("Failed to create projects directory: {}", e))?;
            log::info!("Created projects directory: {:?}", projects_dir);
        }

        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, notify::Config::default())
            .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        // Watch the projects directory
        watcher.watch(&projects_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to start watching projects directory: {}", e))?;

        *watcher_opt = Some(watcher);
        log::debug!("Started watching projects directory: {:?}", projects_dir);

        // Clone necessary values for the async task
        let event_sender = self.event_sender.clone();
        let app_handle = self.app_handle.clone();
        
        // Process file system events in a background task
        tokio::spawn(async move {
            loop {
                match rx.recv() {
                    Ok(Ok(event)) => {
                        if let Err(e) = Self::handle_fs_event(event, &event_sender, &app_handle).await {
                            log::error!("Failed to handle project file system event: {}", e);
                        }
                    }
                    Ok(Err(e)) => {
                        log::error!("File watcher error: {}", e);
                    }
                    Err(mpsc::RecvError) => {
                        break;
                    }
                }
            }
        });

        log::debug!("Project watcher started successfully");
        Ok(())
    }

    /// Stop watching the projects directory
    pub fn stop_watching(&self) -> Result<(), String> {
        let mut watcher_opt = self.watcher.lock().map_err(|e| format!("Lock error: {}", e))?;
        
        if let Some(watcher) = watcher_opt.take() {
            drop(watcher); // This stops the watcher
        }
        
        Ok(())
    }

    /// Handle file system events and emit appropriate project events
    async fn handle_fs_event(
        event: Event,
        event_sender: &broadcast::Sender<ProjectFileEvent>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        log::debug!("Project file system event: {:?}", event);

        for path in event.paths {
            // Only handle directory events in the projects folder
            if !path.is_dir() {
                // For file events, get the parent directory (project)
                if let Some(parent) = path.parent() {
                    if let Some(project_id) = parent.file_name().and_then(|n| n.to_str()) {
                        // Skip hidden directories
                        if project_id.starts_with('.') {
                            continue;
                        }

                        let project_event = ProjectFileEvent::ProjectModified {
                            project_id: project_id.to_string(),
                        };

                        // Emit to local subscribers
                        if let Err(e) = event_sender.send(project_event.clone()) {
                            log::warn!("No project event subscribers: {}", e);
                        }

                        // Emit to frontend via Tauri
                        if let Err(e) = app_handle.emit("project_file_event", &project_event) {
                            log::error!("Failed to emit project event to frontend: {}", e);
                        }
                    }
                }
                continue;
            }

            // Handle directory events (project added/removed)
            if let Some(project_id) = path.file_name().and_then(|n| n.to_str()) {
                // Skip hidden directories
                if project_id.starts_with('.') {
                    continue;
                }

                let project_event = match event.kind {
                    EventKind::Create(_) => ProjectFileEvent::ProjectAdded {
                        project_id: project_id.to_string(),
                    },
                    EventKind::Remove(_) => ProjectFileEvent::ProjectRemoved {
                        project_id: project_id.to_string(),
                    },
                    _ => ProjectFileEvent::ProjectModified {
                        project_id: project_id.to_string(),
                    },
                };

                // Emit to local subscribers
                if let Err(e) = event_sender.send(project_event.clone()) {
                    log::warn!("No project event subscribers: {}", e);
                }

                // Emit to frontend via Tauri
                if let Err(e) = app_handle.emit("project_file_event", &project_event) {
                    log::error!("Failed to emit project event to frontend: {}", e);
                }

                log::debug!("Emitted project event: {:?}", project_event);
            }
        }

        Ok(())
    }

}

/// Start watching the projects directory for changes
#[command]
pub async fn start_project_watching(
    state: State<'_, ProjectWatcherState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut manager_opt = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    // Create manager if it doesn't exist
    if manager_opt.is_none() {
        *manager_opt = Some(ProjectWatcherManager::new(app_handle));
    }
    
    if let Some(manager) = manager_opt.as_ref() {
        manager.start_watching()?;
    }
    
    Ok(())
}

/// Stop watching the projects directory
#[command]
pub async fn stop_project_watching(
    state: State<'_, ProjectWatcherState>,
) -> Result<(), String> {
    let manager_opt = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(manager) = manager_opt.as_ref() {
        manager.stop_watching()?;
        log::debug!("Project watcher stopped successfully");
    }
    
    Ok(())
}

