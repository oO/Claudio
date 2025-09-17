use crate::commands::claude::get_claude_dir;
use notify::{Watcher, RecursiveMode, Event, RecommendedWatcher};
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use tauri::{command, AppHandle, State, Emitter};
use tokio::sync::broadcast;
use tokio::time::{sleep, Duration};
use serde::{Deserialize, Serialize};

/// Event types for todo file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum TodoEvent {
    /// Todo file was created (new todos for a session)
    TodoCreated {
        session_id: String,
        agent_id: String,
        file_path: String,
        todo_counts: crate::commands::claude::types::TodoCounts,
        created_at: u64,
    },
    /// Todo file was modified (todos updated)
    TodoModified {
        session_id: String,
        agent_id: String,
        file_path: String,
        todo_counts: crate::commands::claude::types::TodoCounts,
        modified_at: u64,
    },
    /// Todo file was removed (todos deleted)
    TodoRemoved {
        session_id: String,
        agent_id: String,
        file_path: String,
    },
}

impl TodoEvent {
    /// Get the session ID for this event
    pub fn get_session_id(&self) -> &str {
        match self {
            TodoEvent::TodoCreated { session_id, .. } => session_id,
            TodoEvent::TodoModified { session_id, .. } => session_id,
            TodoEvent::TodoRemoved { session_id, .. } => session_id,
        }
    }

    /// Get the agent ID for this event
    pub fn get_agent_id(&self) -> &str {
        match self {
            TodoEvent::TodoCreated { agent_id, .. } => agent_id,
            TodoEvent::TodoModified { agent_id, .. } => agent_id,
            TodoEvent::TodoRemoved { agent_id, .. } => agent_id,
        }
    }
}

/// Global singleton for watching todo files
pub struct TodoWatcherManager {
    watcher: Option<RecommendedWatcher>,
    event_sender: broadcast::Sender<TodoEvent>,
    app_handle: AppHandle,
}

/// Global state for todo file watcher
pub type TodoWatcherState = Arc<Mutex<Option<TodoWatcherManager>>>;

impl TodoWatcherManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, _rx) = broadcast::channel(100); // Buffer up to 100 events
        
        Self {
            watcher: None,
            event_sender: tx,
            app_handle,
        }
    }

    /// Start watching the global todos directory
    pub fn start_watching(&mut self) -> Result<(), String> {
        // Don't start if already watching
        if self.watcher.is_some() {
            return Ok(());
        }

        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let todos_dir = claude_dir.join("todos");

        // Create todos directory if it doesn't exist
        if !todos_dir.exists() {
            std::fs::create_dir_all(&todos_dir)
                .map_err(|e| format!("Failed to create todos directory: {}", e))?;
            log::info!("Created todos directory: {:?}", todos_dir);
        }

        let (tx, rx) = mpsc::channel();
        let event_sender = self.event_sender.clone();
        let app_handle = self.app_handle.clone();

        let mut watcher = RecommendedWatcher::new(
            move |result: Result<Event, notify::Error>| {
                if let Ok(event) = result {
                    if let Some(todo_event) = Self::create_todo_event_from_notify(&event) {
                        let _ = tx.send(todo_event);
                    }
                }
            },
            notify::Config::default(),
        ).map_err(|e| format!("Failed to create todo watcher: {}", e))?;

        // Watch the todos directory
        watcher.watch(&todos_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to start watching todos directory: {}", e))?;

        // Spawn async task to handle todo events
        tokio::spawn(async move {
            Self::handle_todo_events(rx, event_sender, app_handle).await;
        });

        self.watcher = Some(watcher);
        log::info!("Started global todo file watcher: {:?}", todos_dir);
        
        Ok(())
    }

    /// Stop watching todos
    pub fn stop_watching(&mut self) {
        if let Some(_watcher) = self.watcher.take() {
            // Watcher will be dropped and stop watching
            log::info!("Stopped global todo file watcher");
        }
    }

    /// Create a todo event from a notify file system event
    fn create_todo_event_from_notify(event: &Event) -> Option<TodoEvent> {
        use notify::EventKind::*;
        use std::time::{SystemTime, UNIX_EPOCH};

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Only process events for JSON files in the todos directory
        for path in &event.paths {
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                if filename.ends_with(".json") && filename.contains("-agent-") {
                    // Parse filename: {session_id}-agent-{agent_id}.json
                    let parts: Vec<&str> = filename.split("-agent-").collect();
                    if parts.len() == 2 {
                        let session_id = parts[0].to_string();
                        let agent_id = parts[1].strip_suffix(".json").unwrap_or(parts[1]).to_string();
                        let file_path = path.to_string_lossy().to_string();

                        return match &event.kind {
                            Create(_) => {
                                // Try to read todo counts
                                if let Ok(todos) = crate::commands::claude::types::parse_agent_todo_file(path) {
                                    let todo_counts = crate::commands::claude::types::count_todos_by_status(&todos);
                                    Some(TodoEvent::TodoCreated {
                                        session_id,
                                        agent_id,
                                        file_path,
                                        todo_counts,
                                        created_at: timestamp,
                                    })
                                } else {
                                    log::warn!("Failed to parse todo file on create: {}", filename);
                                    None
                                }
                            }
                            Modify(_) => {
                                // Try to read todo counts
                                if let Ok(todos) = crate::commands::claude::types::parse_agent_todo_file(path) {
                                    let todo_counts = crate::commands::claude::types::count_todos_by_status(&todos);
                                    Some(TodoEvent::TodoModified {
                                        session_id,
                                        agent_id,
                                        file_path,
                                        todo_counts,
                                        modified_at: timestamp,
                                    })
                                } else {
                                    log::warn!("Failed to parse todo file on modify: {}", filename);
                                    None
                                }
                            }
                            Remove(_) => {
                                Some(TodoEvent::TodoRemoved {
                                    session_id,
                                    agent_id,
                                    file_path,
                                })
                            }
                            _ => None,
                        };
                    }
                }
            }
        }

        None
    }

    /// Handle todo events with debouncing and emit to frontend
    async fn handle_todo_events(
        rx: mpsc::Receiver<TodoEvent>,
        event_sender: broadcast::Sender<TodoEvent>,
        app_handle: AppHandle,
    ) {
        use std::collections::HashMap;
        
        let debounce_duration = Duration::from_millis(100);
        let pending_timers: Arc<std::sync::Mutex<HashMap<String, tokio::task::JoinHandle<()>>>> = 
            Arc::new(std::sync::Mutex::new(HashMap::new()));
        
        // Process events as they come in
        tokio::task::spawn_blocking(move || {
            let rt = tokio::runtime::Handle::current();
            
            for todo_event in rx {
                // Use session_id:agent_id as debounce key
                let key = format!("{}:{}", todo_event.get_session_id(), todo_event.get_agent_id());
                
                rt.block_on(async {
                    // Cancel any existing timer for this session:agent
                    if let Ok(mut timers) = pending_timers.lock() {
                        if let Some(existing_timer) = timers.remove(&key) {
                            existing_timer.abort();
                        }
                    }
                    
                    // Start a new debounce timer
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
                        
                        // After debounce period, emit the event
                        
                        // Send event via broadcast channel
                        if let Err(e) = event_sender_clone.send(todo_event.clone()) {
                            log::error!("Failed to send todo event via broadcast: {}", e);
                        }

                        // Also emit as Tauri event to frontend
                        if let Err(e) = app_handle_clone.emit("todo-changed", &todo_event) {
                            log::error!("Failed to emit todo event to frontend: {}", e);
                        }
                    });
                    
                    // Store the timer handle
                    if let Ok(mut timers) = pending_timers.lock() {
                        timers.insert(key, timer_handle);
                    }
                });
            }
        });
    }
}

/// Initialize the global todo watcher
pub fn init_todo_watcher(app_handle: AppHandle) -> TodoWatcherState {
    let manager = TodoWatcherManager::new(app_handle);
    Arc::new(Mutex::new(Some(manager)))
}

/// Start the global todo watcher
#[command]
pub async fn start_todo_watching(
    state: State<'_, TodoWatcherState>,
) -> Result<(), String> {
    if let Ok(mut manager_opt) = state.lock() {
        if let Some(manager) = manager_opt.as_mut() {
            manager.start_watching()?;
        } else {
            return Err("Todo watcher manager not initialized".to_string());
        }
    } else {
        return Err("Failed to acquire todo watcher lock".to_string());
    }
    
    Ok(())
}

/// Stop the global todo watcher
#[command]
pub async fn stop_todo_watching(
    state: State<'_, TodoWatcherState>,
) -> Result<(), String> {
    if let Ok(mut manager_opt) = state.lock() {
        if let Some(manager) = manager_opt.as_mut() {
            manager.stop_watching();
            log::info!("Global todo watcher stopped");
        }
    } else {
        return Err("Failed to acquire todo watcher lock".to_string());
    }
    
    Ok(())
}

/// Get todo watching status
#[command]
pub async fn get_todo_watching_status(
    state: State<'_, TodoWatcherState>,
) -> Result<bool, String> {
    if let Ok(manager_opt) = state.lock() {
        if let Some(manager) = manager_opt.as_ref() {
            Ok(manager.watcher.is_some())
        } else {
            Ok(false)
        }
    } else {
        Err("Failed to acquire todo watcher lock".to_string())
    }
}