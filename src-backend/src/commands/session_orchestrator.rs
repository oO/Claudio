use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{command, AppHandle, Emitter};
use uuid::Uuid;
use chrono;
use crate::paths::CLAUDIO_SESSION_PREFIX;

use crate::commands::claudio_storage::{
    get_claudio_session, create_claudio_session,
};
use crate::commands::claude_direct::{start_claude_direct_session, ClaudeDirectOptions};
use crate::commands::claude::{SessionFileEvent, SessionWatcherState};
use tokio::sync::broadcast;

// Session type constants - single source of truth
pub const SESSION_TYPE_CLAUDIO: &str = "CLAUDIO";
pub const SESSION_TYPE_NATIVE: &str = "NATIVE";

/// Types of sessions that can be managed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SessionType {
    /// Interactive Claudio session that manages multiple native sessions
    #[serde(rename = "CLAUDIO")] // Must match SESSION_TYPE_CLAUDIO
    Claudio { claudio_id: Option<String> },
    /// Read-only native Claude Code session
    #[serde(rename = "NATIVE")] // Must match SESSION_TYPE_NATIVE
    Native { session_id: String },
    /// Archived session with no wrapper file (just raw JSONL)
    #[serde(rename = "ARCHIVED")]
    Archived { session_id: String },
}

/// Current state of a session handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub handle_id: String,
    pub session_type: SessionType,
    pub project_id: String,        // Encoded folder name: -Users-olivier-Projects-claudio
    pub project_path: String,      // Actual file path: /Users/olivier/Projects/claudio
    pub current_claude_session_id: Option<String>,
    pub message_count: usize,
    pub is_streaming: bool,
    pub last_updated: i64,
    pub session_file_path: Option<String>,
    pub permission_mode: String,
}

/// Messages streamed to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamedMessage {
    pub handle_id: String,
    pub message_type: String, // "user", "assistant", "system", etc
    pub content: serde_json::Value,
    pub uuid: String,
    pub timestamp: String,
}

/// Session handle for frontend communication
pub struct SessionHandle {
    pub handle_id: String,
    pub session_type: SessionType,
    pub project_path: String,
    pub current_claude_session: Arc<RwLock<Option<String>>>,
    pub app_handle: AppHandle,
    pub last_processed_message_count: Arc<RwLock<usize>>,
    pub file_event_receiver: Arc<RwLock<Option<broadcast::Receiver<SessionFileEvent>>>>,
}

impl SessionHandle {
    /// Send a prompt to this session (handles all backend complexity)
    pub async fn send_prompt(&self, prompt: String) -> Result<(), String> {
        match &self.session_type {
            SessionType::Claudio { claudio_id } => {
                self.send_claudio_prompt(claudio_id.as_deref(), prompt).await
            },
            SessionType::Native { .. } => {
                Err("Cannot send prompts to read-only native sessions".to_string())
            },
            SessionType::Archived { .. } => {
                Err("Cannot send prompts to archived sessions - resume them first".to_string())
            }
        }
    }

    /// Internal method to handle Claudio session prompts
    async fn send_claudio_prompt(&self, claudio_id: Option<&str>, prompt: String) -> Result<(), String> {
        // Generate real claudio_id if this is a new session
        let actual_claudio_id = match claudio_id {
            Some(id) => id.to_string(),
            None => {
                // First prompt for new session - generate real claudio_id
                format!("claudio-{}", chrono::Utc::now().timestamp_millis())
            }
        };

        // Get current Claude session ID for --resume by reading fresh from storage
        // (don't rely on stale session handle state)
        let current_claude_session = if actual_claudio_id.starts_with(CLAUDIO_SESSION_PREFIX) {
            match crate::commands::claudio_storage::get_claudio_session(actual_claudio_id.clone(), self.project_path.clone()).await {
                Ok(claudio_session) => {
                    log::debug!("Found Claudio session with Claude session ID: {:?}", claudio_session.current_session.as_ref().map(|s| &s.session_id));
                    claudio_session.current_session.map(|s| s.session_id)
                },
                Err(_) => {
                    log::debug!("No existing Claudio session found, starting fresh");
                    None
                }
            }
        } else {
            None
        };

        // Get permission mode from Claudio session
        let permission_mode = if actual_claudio_id.starts_with(CLAUDIO_SESSION_PREFIX) {
            match crate::commands::claudio_storage::get_claudio_session(actual_claudio_id.clone(), self.project_path.clone()).await {
                Ok(claudio_session) => Some(claudio_session.permission_mode),
                Err(_) => Some("default".to_string()), // Default for new sessions
            }
        } else {
            Some("default".to_string())
        };

        // Prepare options for Claude CLI
        let options = ClaudeDirectOptions {
            max_turns: None,
            custom_system_prompt: None,
            allowed_tools: Some(vec![
                "Bash".to_string(),
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "LS".to_string(),
                "Grep".to_string(),
            ]),
            working_directory: Some(self.project_path.clone()),
            session_id: current_claude_session, // For --resume
            claudio_id: Some(actual_claudio_id),
            permission_mode,
        };

        // Generate temp session ID for this prompt execution
        let temp_session_id = format!("temp-{}", Uuid::new_v4());

        // Start Claude CLI session (this will handle all the complexity)
        start_claude_direct_session(
            self.app_handle.clone(),
            temp_session_id,
            self.project_path.clone(),
            prompt,
            options,
        ).await?;

        // For Claudio sessions, we should NOT auto-switch to the "latest" session
        // Each Claudio session maintains its own dedicated Claude session ID
        // Only Native sessions should auto-track the latest session file
        match &self.session_type {
            SessionType::Native { .. } => {
                // Only for Native sessions - track the most recent session file
                tokio::spawn({
                    let current_claude_session = self.current_claude_session.clone();
                    let project_path = self.project_path.clone();
                    async move {
                        // Give Claude a moment to finish writing the session file
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

                        if let Err(e) = Self::update_current_session_id(current_claude_session, project_path).await {
                            log::error!("Failed to update current session ID: {}", e);
                        }
                    }
                });
            },
            SessionType::Claudio { claudio_id: Some(claudio_id_str) } => {
                // For Claudio sessions, update the handle's current session after execution
                let current_claude_session = self.current_claude_session.clone();
                let project_path = self.project_path.clone();
                let claudio_id_for_update = claudio_id_str.clone();

                tokio::spawn(async move {
                    // Give Claude a moment to finish and update_session_claude_id to run
                    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

                    // Re-read the Claudio session to get the updated Claude session ID
                    if let Ok(claudio_session) = crate::commands::claudio_storage::get_claudio_session(claudio_id_for_update, project_path).await {
                        let mut guard = current_claude_session.write().await;
                        *guard = claudio_session.current_session.map(|s| s.session_id);
                        log::debug!("Updated session handle's current Claude session ID: {:?}", guard);
                    }
                });
            },
            SessionType::Claudio { claudio_id: None } => {
                // Should not happen after prompt execution
                log::warn!("Claudio session with no ID after prompt execution");
            },
            SessionType::Archived { .. } => {
                // Archived sessions don't get prompt updates since they can't accept prompts
                log::debug!("Prompt execution completed for archived session (no action needed)");
            }
        }

        Ok(())
    }

    /// Get complete message history for this session
    pub async fn get_message_history(&self) -> Result<Vec<serde_json::Value>, String> {
        match &self.session_type {
            SessionType::Claudio { claudio_id } => {
                self.get_claudio_message_history(claudio_id.as_deref()).await
            },
            SessionType::Native { session_id } => {
                self.get_native_message_history(session_id).await
            },
            SessionType::Archived { session_id } => {
                // Archived sessions are read-only, same as native
                self.get_native_message_history(session_id).await
            }
        }
    }

    async fn get_claudio_message_history(&self, _claudio_id: Option<&str>) -> Result<Vec<serde_json::Value>, String> {
        // Get current Claude session being tracked
        let current_claude_session = {
            let guard = self.current_claude_session.read().await;
            guard.clone()
        };

        if let Some(claude_session_id) = current_claude_session {
            self.get_native_message_history(&claude_session_id).await
        } else {
            Ok(Vec::new()) // No messages yet
        }
    }

    async fn get_native_message_history(&self, session_id: &str) -> Result<Vec<serde_json::Value>, String> {
        use crate::commands::claude::get_claude_dir;
        use std::fs;
        use std::io::{BufRead, BufReader};

        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let project_id = crate::commands::claudio_storage::get_project_id_for_path(&self.project_path).await?;
        let session_file_path = claude_dir
            .join("projects")
            .join(project_id)
            .join(format!("{}.jsonl", session_id));

        if !session_file_path.exists() {
            return Ok(Vec::new());
        }

        let file = fs::File::open(&session_file_path)
            .map_err(|e| format!("Failed to open session file: {}", e))?;

        let reader = BufReader::new(file);
        let mut messages = Vec::new();

        for line in reader.lines() {
            let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
            if !line.trim().is_empty() {
                match serde_json::from_str::<serde_json::Value>(&line) {
                    Ok(message) => messages.push(message),
                    Err(e) => {
                        log::warn!("Failed to parse message line: {}", e);
                    }
                }
            }
        }

        Ok(messages)
    }

    /// Start streaming messages from this session's file
    pub async fn start_message_streaming(&self, session_watcher_state: &SessionWatcherState) -> Result<(), String> {
        // Get project ID from path
        let project_id = crate::commands::claudio_storage::get_project_id_for_path(&self.project_path).await?;

        // Get the session watcher manager and subscribe to events
        let receiver = {
            let state_guard = session_watcher_state.lock().map_err(|e| format!("Lock error: {}", e))?;
            if let Some(manager) = state_guard.as_ref() {
                manager.start_watching_project(&project_id)?;

                // Subscribe to file events
                manager.subscribe_to_events()
            } else {
                return Err("Session watcher manager not initialized".to_string());
            }
        };

        // Store the receiver for this session handle (now without holding the lock)
        {
            let mut file_event_receiver_guard = self.file_event_receiver.write().await;
            *file_event_receiver_guard = Some(receiver);
        }

        // Spawn task to process file events for this handle
        let handle_id = self.handle_id.clone();
        let project_id_clone = project_id.clone();
        let app_handle = self.app_handle.clone();
        let current_claude_session = self.current_claude_session.clone();
        let last_processed_count = self.last_processed_message_count.clone();
        let file_event_receiver = self.file_event_receiver.clone();

        tokio::spawn(async move {
            Self::process_file_events(
                handle_id,
                project_id_clone,
                app_handle,
                current_claude_session,
                last_processed_count,
                file_event_receiver,
            ).await;
        });

        Ok(())
    }

    /// Process file events and stream new messages to frontend
    async fn process_file_events(
        handle_id: String,
        project_id: String,
        app_handle: AppHandle,
        current_claude_session: Arc<RwLock<Option<String>>>,
        last_processed_count: Arc<RwLock<usize>>,
        file_event_receiver: Arc<RwLock<Option<broadcast::Receiver<SessionFileEvent>>>>,
    ) {
        log::debug!("Starting process_file_events loop for handle_id={}, project_id={}", handle_id, project_id);
        loop {
            // Get the receiver
            let mut receiver = {
                let mut guard = file_event_receiver.write().await;
                match guard.take() {
                    Some(receiver) => receiver,
                    None => {
                        log::error!("No file event receiver available for handle: {}", handle_id);
                        break;
                    }
                }
            };

            // Listen for file events
            match receiver.recv().await {
                Ok(event) => {
                    // Put receiver back
                    {
                        let mut guard = file_event_receiver.write().await;
                        *guard = Some(receiver);
                    }

                    // Only process events for sessions we're tracking
                    if let SessionFileEvent::Modified { session_id, project_id: event_project_id, .. } = &event {
                        if event_project_id == &project_id {
                            // Check if this file change is relevant to our session handle
                            // For Claudio sessions, always read fresh Claude session ID from memory cache
                            // (memory is the single source of truth)
                            let current_session = if handle_id.starts_with(CLAUDIO_SESSION_PREFIX) {
                                // Claudio session - read fresh Claude session ID from memory cache
                                let project_path = project_id.replace("-", "/");
                                match crate::commands::claudio_storage::get_claudio_session(handle_id.clone(), project_path).await {
                                    Ok(claudio_session) => {
                                        log::debug!("Found Claudio session in cache: claudio_id={}, claude_session_id={:?}", handle_id, claudio_session.current_session.as_ref().map(|s| &s.session_id));
                                        claudio_session.current_session.map(|s| s.session_id)
                                    },
                                    Err(e) => {
                                        log::debug!("Failed to get Claudio session from cache: claudio_id={}, error={}", handle_id, e);
                                        None // Session might not exist yet
                                    }
                                }
                            } else {
                                // Native session - use the session handle's stored value
                                let guard = current_claude_session.read().await;
                                guard.clone()
                            };


                            if let Some(current_session_id) = current_session {
                                if session_id == &current_session_id {
                                    // This is our tracked session - process new messages
                                    if let Err(e) = Self::process_new_messages(
                                        &handle_id,
                                        session_id,
                                        &project_id,
                                        &app_handle,
                                        &last_processed_count,
                                    ).await {
                                        log::error!("Failed to process new messages for handle {}: {}", handle_id, e);
                                    }
                                }
                            }
                        }
                    }
                },
                Err(broadcast::error::RecvError::Lagged(skipped)) => {
                    log::warn!("Session handle {} lagged behind by {} messages", handle_id, skipped);
                    // Put receiver back
                    {
                        let mut guard = file_event_receiver.write().await;
                        *guard = Some(receiver);
                    }
                    continue;
                },
                Err(broadcast::error::RecvError::Closed) => {
                    log::info!("File event channel closed for handle: {}", handle_id);
                    break;
                }
            }
        }
    }

    /// Process new messages from session file and emit to frontend
    async fn process_new_messages(
        handle_id: &str,
        session_id: &str,
        project_id: &str,
        app_handle: &AppHandle,
        last_processed_count: &Arc<RwLock<usize>>,
    ) -> Result<(), String> {
        use crate::commands::claude::get_claude_dir;
        use std::fs;
        use std::io::{BufRead, BufReader};

        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let session_file_path = claude_dir
            .join("projects")
            .join(project_id)
            .join(format!("{}.jsonl", session_id));

        if !session_file_path.exists() {
            return Ok(()); // File doesn't exist yet
        }

        // Read all messages from file
        let file = fs::File::open(&session_file_path)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);
        let mut all_messages = Vec::new();

        for line in reader.lines() {
            let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
            if !line.trim().is_empty() {
                match serde_json::from_str::<serde_json::Value>(&line) {
                    Ok(message) => all_messages.push(message),
                    Err(e) => {
                        log::warn!("Failed to parse message line: {}", e);
                    }
                }
            }
        }

        // For Claudio sessions, we need to find the starting point based on last_message_uuid
        // For native sessions, we use the simple message count approach
        let new_messages: Vec<&serde_json::Value> = if handle_id.starts_with(CLAUDIO_SESSION_PREFIX) {
            // Get the last_message_uuid from the Claudio session metadata
            let project_path = project_id.replace("-", "/");
            match crate::commands::claudio_storage::get_claudio_session(handle_id.to_string(), project_path).await {
                Ok(claudio_session) => {
                    if let Some(last_session) = claudio_session.session_history.last() {
                        let last_uuid = &last_session.last_message_uuid;
                        // Find the index of the last processed message
                        let mut start_index = 0;
                        for (i, message) in all_messages.iter().enumerate() {
                            if let Some(msg_uuid) = message.get("uuid").and_then(|v| v.as_str()) {
                                if msg_uuid == last_uuid {
                                    start_index = i + 1; // Start AFTER the last processed message
                                    break;
                                }
                            }
                        }

                        if start_index < all_messages.len() {
                            all_messages[start_index..].iter().collect()
                        } else {
                            Vec::new()
                        }
                    } else {
                        // No last UUID means this is the first turn - emit all messages
                        all_messages.iter().collect()
                    }
                },
                Err(_) => {
                    // Fall back to count-based approach
                    let last_count = {
                        let guard = last_processed_count.read().await;
                        *guard
                    };
                    if all_messages.len() > last_count {
                        all_messages[last_count..].iter().collect()
                    } else {
                        Vec::new()
                    }
                }
            }
        } else {
            // Native session - use simple message count
            let last_count = {
                let guard = last_processed_count.read().await;
                *guard
            };


            if all_messages.len() > last_count {
                all_messages[last_count..].iter().collect()
            } else {
                Vec::new()
            }
        };


        if !new_messages.is_empty() {

            // Emit each new message
            for message in new_messages {
                let streamed_message = StreamedMessage {
                    handle_id: handle_id.to_string(),
                    message_type: message.get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    content: (*message).clone(), // Dereference since we have &serde_json::Value now
                    uuid: message.get("uuid")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                };

                // Emit to frontend
                if let Err(e) = app_handle.emit("session_message_stream", &streamed_message) {
                    log::error!("Failed to emit message stream event: {}", e);
                }
            }

            // Update processed count
            {
                let mut guard = last_processed_count.write().await;
                *guard = all_messages.len();
            }
        }

        Ok(())
    }

    /// Update the current session ID by finding the most recent session file
    async fn update_current_session_id(
        current_claude_session: Arc<RwLock<Option<String>>>,
        project_path: String,
    ) -> Result<(), String> {
        use crate::commands::claude::get_claude_dir;
        use std::fs;

        let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
        let project_id = crate::commands::claudio_storage::get_project_id_for_path(&project_path).await?;
        let project_sessions_dir = claude_dir.join("projects").join(&project_id);

        if !project_sessions_dir.exists() {
            return Ok(()); // No sessions yet
        }

        // Find the most recently modified .jsonl file
        let mut latest_session_file: Option<(String, std::time::SystemTime)> = None;

        if let Ok(entries) = fs::read_dir(&project_sessions_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                        if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                            if let Ok(metadata) = entry.metadata() {
                                if let Ok(modified) = metadata.modified() {
                                    match &latest_session_file {
                                        None => {
                                            latest_session_file = Some((session_id.to_string(), modified));
                                        }
                                        Some((_, latest_time)) => {
                                            if modified > *latest_time {
                                                latest_session_file = Some((session_id.to_string(), modified));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Update the current session if we found one
        if let Some((session_id, _)) = latest_session_file {
            let mut guard = current_claude_session.write().await;
            *guard = Some(session_id.clone());
        }

        Ok(())
    }
}

/// Main orchestrator for all session operations
pub struct SessionOrchestrator {
    handles: Arc<RwLock<HashMap<String, Arc<SessionHandle>>>>,
    app_handle: AppHandle,
    session_watcher_state: SessionWatcherState,
}

impl SessionOrchestrator {
    pub fn new(app_handle: AppHandle, session_watcher_state: SessionWatcherState) -> Self {
        Self {
            handles: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            session_watcher_state,
        }
    }

    /// Determine if a session ID has wrapper files (Native) or is archived
    async fn determine_session_type_for_id(&self, session_id: &str, project_path: &str) -> SessionType {
        // Check if there's a claude-{session_id}.json file in ~/.claudio
        if let Ok(claudio_dir) = crate::commands::claudio_storage::get_project_claudio_dir(project_path).await {
            let native_wrapper = claudio_dir.join(format!("claude-{}.json", session_id));
            if native_wrapper.exists() {
                log::debug!("Found native wrapper for session {}", session_id);
                return SessionType::Native { session_id: session_id.to_string() };
            }
        }

        // No wrapper file found - it's archived
        log::debug!("No wrapper found for session {}, treating as archived", session_id);
        SessionType::Archived { session_id: session_id.to_string() }
    }

    /// Get or create a session handle
    pub async fn get_session_handle(&self, session_identifier: Option<String>, project_path: String) -> Result<SessionState, String> {
        log::debug!("SessionOrchestrator: get_session_handle called with session_id={:?}, project_path={}", session_identifier, project_path);
        // Determine session type and handle ID based on identifier
        let (session_type, handle_id) = match session_identifier {
            Some(id) => {
                let session_type = if id.starts_with(CLAUDIO_SESSION_PREFIX) {
                    SessionType::Claudio { claudio_id: Some(id.clone()) }
                } else {
                    // Check if this session has any wrapper file to determine if it's Native or Archived
                    self.determine_session_type_for_id(&id, &project_path).await
                };
                (session_type, id)
            },
            None => {
                // New Claudio session - create immediately instead of lazy initialization
                log::debug!("Creating new Claudio session for project: {}", project_path);

                // Create the actual claudio session file and get the claudio_id
                let claudio_id = match create_claudio_session(project_path.clone(), None).await {
                    Ok(id) => id,
                    Err(e) => {
                        log::error!("Failed to create new Claudio session: {}", e);
                        return Err(format!("Failed to create new Claudio session: {}", e));
                    }
                };

                // Use the claudio_id as the handle_id for consistency
                (SessionType::Claudio { claudio_id: Some(claudio_id.clone()) }, claudio_id)
            }
        };

        // Check if handle already exists
        {
            let handles_guard = self.handles.read().await;
            if handles_guard.contains_key(&handle_id) {
                return self.get_session_state(&handle_id, &session_type, &project_path).await;
            }
        }

        // Create new handle
        let current_claude_session = Arc::new(RwLock::new(None::<String>));

        // Set current Claude session ID based on session type
        match &session_type {
            SessionType::Claudio { claudio_id } => {
                if let Some(claudio_id_str) = claudio_id {
                    // Existing Claudio session - load current Claude session ID
                    match get_claudio_session(claudio_id_str.clone(), project_path.clone()).await {
                        Ok(claudio_session) => {
                            let mut guard = current_claude_session.write().await;
                            *guard = claudio_session.current_session.map(|s| s.session_id);
                        },
                        Err(_) => {
                            // Session doesn't exist yet - will be created on first prompt
                        }
                    }
                }
                // For new Claudio sessions (claudio_id = None), current_claude_session remains None
            },
            SessionType::Native { session_id } => {
                // Native session - the session ID IS the Claude session ID
                let mut guard = current_claude_session.write().await;
                *guard = Some(session_id.clone());
                log::debug!("Set current Claude session for native session: {}", session_id);
            },
            SessionType::Archived { session_id } => {
                // Archived session - the session ID IS the Claude session ID (same as native)
                let mut guard = current_claude_session.write().await;
                *guard = Some(session_id.clone());
                log::debug!("Set current Claude session for archived session: {}", session_id);
            }
        }

        let handle = Arc::new(SessionHandle {
            handle_id: handle_id.clone(),
            session_type: session_type.clone(),
            project_path: project_path.clone(),
            current_claude_session,
            app_handle: self.app_handle.clone(),
            last_processed_message_count: Arc::new(RwLock::new(0)),
            file_event_receiver: Arc::new(RwLock::new(None)),
        });

        // Store handle
        {
            let mut handles_guard = self.handles.write().await;
            handles_guard.insert(handle_id.clone(), handle.clone());
            log::debug!("Stored session handle: {} (total: {})", handle_id, handles_guard.len());
        }

        // Set up message streaming for this handle
        if let Err(e) = handle.start_message_streaming(&self.session_watcher_state).await {
            log::error!("Failed to start message streaming for handle {}: {}", handle_id, e);
        } else {
            log::debug!("Started message streaming for handle: {}", handle_id);
        }

        self.get_session_state(&handle_id, &session_type, &project_path).await
    }

    async fn get_session_state(&self, handle_id: &str, session_type: &SessionType, project_path: &str) -> Result<SessionState, String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(handle_id)
            .ok_or_else(|| "Session handle not found".to_string())?;

        // Get current Claude session ID - for Claudio sessions, always re-read from memory cache
        // to ensure we have the latest Claude session ID (memory is the single source of truth)
        let current_claude_session_id = match session_type {
            SessionType::Claudio { claudio_id } => {
                if let Some(claudio_id_str) = claudio_id {
                    // Re-read from memory cache to get fresh Claude session ID
                    match crate::commands::claudio_storage::get_claudio_session(claudio_id_str.clone(), project_path.to_string()).await {
                        Ok(claudio_session) => claudio_session.current_session.map(|s| s.session_id),
                        Err(_) => None // Session might not exist yet
                    }
                } else {
                    None // New session without ID yet
                }
            },
            SessionType::Native { session_id } => {
                // Native sessions use the session ID directly as Claude session ID
                Some(session_id.clone())
            },
            SessionType::Archived { session_id } => {
                // Archived sessions use the session ID directly as Claude session ID (same as native)
                Some(session_id.clone())
            }
        };

        // Get message count - skip for new sessions that don't have a Claude session yet
        let message_count = if current_claude_session_id.is_some() {
            match handle.get_message_history().await {
                Ok(messages) => messages.len(),
                Err(_) => 0,
            }
        } else {
            0 // New session - no messages yet
        };

        // Calculate session file path if we have a claude session ID
        let session_file_path = if let Some(claude_session_id) = &current_claude_session_id {
            // Use the actual Claude home directory, not project-local .claude
            match crate::commands::claude::get_claude_dir() {
                Ok(claude_dir) => {
                    let project_id = match crate::commands::claudio_storage::get_project_id_for_path(&project_path).await {
                        Ok(id) => id,
                        Err(e) => {
                            log::warn!("Could not get project_id for path {}: {}", project_path, e);
                            return Err(format!("Project mapping not found: {}", e));
                        }
                    };
                    let session_file_path = claude_dir
                        .join("projects")
                        .join(project_id)
                        .join(format!("{}.jsonl", claude_session_id));
                    Some(session_file_path.to_string_lossy().to_string())
                },
                Err(_) => None
            }
        } else {
            None
        };

        // Get project ID using discovered mappings
        let project_id = crate::commands::claudio_storage::get_project_id_for_path(&project_path).await?;

        // Get permission mode from Claudio session if it's a claudio session
        let permission_mode = if handle_id.starts_with("claudio-") {
            match get_claudio_session(handle_id.to_string(), project_path.to_string()).await {
                Ok(claudio_session) => claudio_session.permission_mode,
                Err(_) => "default".to_string(),
            }
        } else {
            "default".to_string()
        };

        Ok(SessionState {
            handle_id: handle_id.to_string(),
            session_type: session_type.clone(),
            project_id,
            project_path: project_path.to_string(),
            current_claude_session_id,
            message_count,
            is_streaming: false, // TODO: Track streaming state
            last_updated: chrono::Utc::now().timestamp_millis(),
            session_file_path,
            permission_mode,
        })
    }

    /// Send prompt to a session handle
    pub async fn send_prompt_to_handle(&self, handle_id: String, prompt: String) -> Result<(), String> {
        log::debug!("send_prompt_to_handle called with handle_id={}, prompt_preview={}", handle_id, prompt.chars().take(50).collect::<String>());

        let handles_guard = self.handles.read().await;

        let handle = handles_guard.get(&handle_id)
            .ok_or_else(|| {
                let existing_handles: Vec<String> = handles_guard.keys().cloned().collect();
                log::error!("SESSION HANDLE NOT FOUND: {} (available: {:?})", handle_id, existing_handles);
                "Session handle not found".to_string()
            })?;

        log::debug!("Found handle, calling handle.send_prompt...");
        handle.send_prompt(prompt).await
    }

    /// Get messages for a session handle
    pub async fn get_handle_messages(&self, handle_id: String) -> Result<Vec<serde_json::Value>, String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(&handle_id)
            .ok_or_else(|| "Session handle not found".to_string())?;

        handle.get_message_history().await
    }

    /// Get project path for a session handle
    pub async fn get_handle_project_path(&self, handle_id: &str) -> Result<String, String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(handle_id)
            .ok_or_else(|| format!("Session handle not found: {}", handle_id))?;

        Ok(handle.project_path.clone())
    }
}

// Global orchestrator instance (will be initialized in main.rs)
use std::sync::OnceLock;
static GLOBAL_ORCHESTRATOR: OnceLock<Arc<SessionOrchestrator>> = OnceLock::new();

pub fn initialize_orchestrator(app_handle: AppHandle, session_watcher_state: SessionWatcherState) {
    let orchestrator = Arc::new(SessionOrchestrator::new(app_handle, session_watcher_state));
    if GLOBAL_ORCHESTRATOR.set(orchestrator).is_err() {
        panic!("SessionOrchestrator already initialized");
    }
}

pub fn get_orchestrator() -> Result<Arc<SessionOrchestrator>, String> {
    GLOBAL_ORCHESTRATOR
        .get()
        .ok_or_else(|| "SessionOrchestrator not initialized".to_string())
        .cloned()
}

/// Tauri command: Get session handle
#[command]
pub async fn get_session_handle(session_id: Option<String>, project_path: String) -> Result<SessionState, String> {
    let orchestrator = get_orchestrator()?;
    orchestrator.get_session_handle(session_id, project_path).await
}

/// Tauri command: Send prompt to session
#[command]
pub async fn send_session_prompt(
    app: tauri::AppHandle,
    handle_id: String,
    prompt: String
) -> Result<(), String> {
    // For Claudio sessions, emit active thinking event IMMEDIATELY when prompt is received
    if handle_id.starts_with(CLAUDIO_SESSION_PREFIX) {
        let orchestrator = get_orchestrator()?;

        // Get project path from the session handle
        let project_path = orchestrator.get_handle_project_path(&handle_id).await?;

        // Emit active status immediately
        emit_claudio_thinking_event(&app, &handle_id, &project_path, "active").await;
    }

    let orchestrator = get_orchestrator()?;
    orchestrator.send_prompt_to_handle(handle_id, prompt).await
}

/// Tauri command: Get session messages
#[command]
pub async fn get_session_messages(handle_id: String) -> Result<Vec<serde_json::Value>, String> {
    let orchestrator = get_orchestrator()?;
    orchestrator.get_handle_messages(handle_id).await
}

/// Emit thinking events for Claudio sessions (equivalent to hook scripts for native sessions)
async fn emit_claudio_thinking_event(
    app: &tauri::AppHandle,
    claudio_id: &str,
    project_path: &str,
    status: &str, // "active" or "idle"
) {
    use crate::commands::claude_session_tracking::ClaudeThinkingEvent;
    use crate::commands::claude_direct::get_thinking_content;

    // Emit the same event format that native sessions use
    let event_data = ClaudeThinkingEvent {
        session_id: claudio_id.to_string(), // Use claudio_id as session identifier
        project_path: project_path.to_string(),
        status: status.to_string(),
        title: if status == "active" {
            // Get thinking content for active status
            let (title, _message) = get_thinking_content();
            Some(title)
        } else {
            None
        },
        message: if status == "active" {
            let (_title, message) = get_thinking_content();
            Some(message)
        } else {
            None
        },
    };

    // Emit the same event that native sessions emit
    if let Err(e) = app.emit("claude-session-thinking", &event_data) {
        log::error!("Failed to emit Claudio thinking event: {}", e);
    } else {
        log::debug!("Emitted Claudio thinking event: {} -> {}", claudio_id, status);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test as tokio_test;
    use std::collections::HashMap;
    use tempfile::TempDir;
    use crate::commands::claudio_storage::{ClaudioSession, SessionInfo, SessionStatus};

    // Mock app handle for testing
    struct MockAppHandle;

    impl MockAppHandle {
        fn new() -> Self {
            Self
        }
    }

    // Helper function to create a mock session watcher state
    fn create_mock_session_watcher_state() -> SessionWatcherState {
        use std::sync::{Arc, Mutex};
        Arc::new(Mutex::new(None))
    }

    // Helper function to create a test session handle
    fn create_test_session_handle(
        handle_id: String,
        session_type: SessionType,
        project_path: String,
    ) -> SessionHandle {
        SessionHandle {
            handle_id,
            session_type,
            project_path,
            current_claude_session: Arc::new(RwLock::new(None)),
            app_handle: tauri::AppHandle::new(), // This will panic in tests, but we won't use it
            last_processed_message_count: Arc::new(RwLock::new(0)),
            file_event_receiver: Arc::new(RwLock::new(None)),
        }
    }

    #[tokio_test]
    async fn test_session_type_serialization() {
        // Test Claudio session type
        let claudio_type = SessionType::Claudio { claudio_id: Some("claudio-123".to_string()) };
        let json = serde_json::to_string(&claudio_type).unwrap();
        let deserialized: SessionType = serde_json::from_str(&json).unwrap();

        match deserialized {
            SessionType::Claudio { claudio_id } => {
                assert_eq!(claudio_id.unwrap(), "claudio-123");
            },
            _ => panic!("Wrong session type"),
        }

        // Test Native session type
        let native_type = SessionType::Native { session_id: "session-456".to_string() };
        let json = serde_json::to_string(&native_type).unwrap();
        let deserialized: SessionType = serde_json::from_str(&json).unwrap();

        match deserialized {
            SessionType::Native { session_id } => {
                assert_eq!(session_id, "session-456");
            },
            _ => panic!("Wrong session type"),
        }

        // Test Archived session type
        let archived_type = SessionType::Archived { session_id: "archived-789".to_string() };
        let json = serde_json::to_string(&archived_type).unwrap();
        let deserialized: SessionType = serde_json::from_str(&json).unwrap();

        match deserialized {
            SessionType::Archived { session_id } => {
                assert_eq!(session_id, "archived-789");
            },
            _ => panic!("Wrong session type"),
        }
    }

    #[tokio_test]
    async fn test_session_state_creation() {
        let session_state = SessionState {
            handle_id: "test-handle-123".to_string(),
            session_type: SessionType::Claudio { claudio_id: Some("claudio-456".to_string()) },
            project_id: "-Users-test-project".to_string(),
            project_path: "/Users/test/project".to_string(),
            current_claude_session_id: Some("claude-session-789".to_string()),
            message_count: 5,
            is_streaming: false,
            last_updated: chrono::Utc::now().timestamp_millis(),
            session_file_path: Some("/path/to/session.jsonl".to_string()),
            permission_mode: "default".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&session_state).unwrap();
        let deserialized: SessionState = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.handle_id, "test-handle-123");
        assert_eq!(deserialized.project_path, "/Users/test/project");
        assert_eq!(deserialized.message_count, 5);
        assert_eq!(deserialized.permission_mode, "default");
    }

    #[tokio_test]
    async fn test_streamed_message_creation() {
        let message = StreamedMessage {
            handle_id: "test-handle".to_string(),
            message_type: "user".to_string(),
            content: serde_json::json!({"text": "Hello, world!"}),
            uuid: "uuid-123".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        // Test serialization
        let json = serde_json::to_string(&message).unwrap();
        let deserialized: StreamedMessage = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.handle_id, "test-handle");
        assert_eq!(deserialized.message_type, "user");
        assert_eq!(deserialized.uuid, "uuid-123");
        assert_eq!(deserialized.content["text"], "Hello, world!");
    }

    #[test]
    fn test_session_type_constants() {
        assert_eq!(SESSION_TYPE_CLAUDIO, "CLAUDIO");
        assert_eq!(SESSION_TYPE_NATIVE, "NATIVE");
    }

    #[tokio_test]
    async fn test_session_handle_prompt_routing() {
        // Test that different session types route prompts correctly
        let project_path = "/test/project".to_string();

        // Test Claudio session - should succeed (mock implementation)
        let claudio_handle = create_test_session_handle(
            "claudio-123".to_string(),
            SessionType::Claudio { claudio_id: Some("claudio-123".to_string()) },
            project_path.clone(),
        );

        // This would normally call send_claudio_prompt, but will fail in test due to dependencies
        // In a real implementation, we'd use dependency injection

        // Test Native session - should fail with appropriate error
        let native_handle = create_test_session_handle(
            "native-456".to_string(),
            SessionType::Native { session_id: "native-456".to_string() },
            project_path.clone(),
        );

        let result = native_handle.send_prompt("test prompt".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot send prompts to read-only native sessions"));

        // Test Archived session - should fail with appropriate error
        let archived_handle = create_test_session_handle(
            "archived-789".to_string(),
            SessionType::Archived { session_id: "archived-789".to_string() },
            project_path,
        );

        let result = archived_handle.send_prompt("test prompt".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot send prompts to archived sessions"));
    }

    #[tokio_test]
    async fn test_session_orchestrator_initialization() {
        let temp_dir = TempDir::new().unwrap();
        let app_handle = tauri::AppHandle::new(); // This will panic, but we won't use it
        let session_watcher_state = create_mock_session_watcher_state();

        // This would normally create a SessionOrchestrator, but requires a real AppHandle
        // In a production environment, we'd use dependency injection to make this testable

        // Test the struct creation manually
        let handles: Arc<RwLock<HashMap<String, Arc<SessionHandle>>>> =
            Arc::new(RwLock::new(HashMap::new()));

        assert_eq!(handles.read().await.len(), 0);
    }

    #[tokio_test]
    async fn test_concurrent_session_handle_access() {
        let handles: Arc<RwLock<HashMap<String, Arc<SessionHandle>>>> =
            Arc::new(RwLock::new(HashMap::new()));

        // Spawn multiple tasks that modify the handles map concurrently
        let tasks = (0..10).map(|i| {
            let handles_clone = handles.clone();
            let handle_id = format!("test-handle-{}", i);
            tokio::spawn(async move {
                // Simulate adding a handle (without actually creating one due to AppHandle dependency)
                let mut guard = handles_clone.write().await;
                // We can't create actual SessionHandles due to AppHandle requirement
                // but we can test the concurrent access pattern
                handle_id
            })
        }).collect::<Vec<_>>();

        // Wait for all tasks to complete
        let mut completed_ids = Vec::new();
        for task in tasks {
            let id = task.await.unwrap();
            completed_ids.push(id);
        }

        assert_eq!(completed_ids.len(), 10);
        for i in 0..10 {
            assert!(completed_ids.contains(&format!("test-handle-{}", i)));
        }
    }

    #[tokio_test]
    async fn test_message_processing_logic() {
        // Test the logic for processing new messages based on UUID vs count
        let all_messages = vec![
            serde_json::json!({
                "uuid": "msg-1",
                "type": "user",
                "content": "Hello"
            }),
            serde_json::json!({
                "uuid": "msg-2",
                "type": "assistant",
                "content": "Hi there!"
            }),
            serde_json::json!({
                "uuid": "msg-3",
                "type": "user",
                "content": "How are you?"
            })
        ];

        // Test UUID-based processing (Claudio sessions)
        let last_uuid = "msg-1";
        let mut start_index = 0;
        for (i, message) in all_messages.iter().enumerate() {
            if let Some(msg_uuid) = message.get("uuid").and_then(|v| v.as_str()) {
                if msg_uuid == last_uuid {
                    start_index = i + 1; // Start AFTER the last processed message
                    break;
                }
            }
        }

        let new_messages: Vec<&serde_json::Value> = if start_index < all_messages.len() {
            all_messages[start_index..].iter().collect()
        } else {
            Vec::new()
        };

        assert_eq!(new_messages.len(), 2);
        assert_eq!(new_messages[0].get("uuid").unwrap(), "msg-2");
        assert_eq!(new_messages[1].get("uuid").unwrap(), "msg-3");

        // Test count-based processing (Native sessions)
        let last_count = 1;
        let count_based_messages: Vec<&serde_json::Value> = if all_messages.len() > last_count {
            all_messages[last_count..].iter().collect()
        } else {
            Vec::new()
        };

        assert_eq!(count_based_messages.len(), 2);
        assert_eq!(count_based_messages[0].get("uuid").unwrap(), "msg-2");
        assert_eq!(count_based_messages[1].get("uuid").unwrap(), "msg-3");
    }

    #[tokio_test]
    async fn test_project_id_encoding() {
        // Test project path to project ID encoding
        let project_path = "/Users/test/My Project/with spaces";
        let project_id = project_path.replace('/', "-").replace(' ', "-");

        assert_eq!(project_id, "-Users-test-My-Project-with-spaces");

        // Test reverse (decode) - note this is lossy for spaces vs dashes
        let decoded = project_id.replace("-", "/");
        // This will be "/Users/test/My/Project/with/spaces" - not exact reverse
        assert!(decoded.starts_with("/Users/test/My"));
    }

    #[tokio_test]
    async fn test_session_file_path_construction() {
        let project_path = "/Users/test/project";
        let project_id = project_path.replace("/", "-");
        let claude_session_id = "session-123";

        // Test session file path construction
        // In real implementation this would use get_claude_dir()
        let mock_claude_dir = "/Users/test/.claude";
        let session_file_path = format!("{}/projects/{}/{}.jsonl",
                                       mock_claude_dir, project_id, claude_session_id);

        assert_eq!(session_file_path, "/Users/test/.claude/projects/-Users-test-project/session-123.jsonl");
    }

    #[tokio_test]
    async fn test_permission_mode_defaults() {
        // Test default permission mode behavior
        let session_state = SessionState {
            handle_id: "test".to_string(),
            session_type: SessionType::Native { session_id: "test".to_string() },
            project_id: "test".to_string(),
            project_path: "test".to_string(),
            current_claude_session_id: None,
            message_count: 0,
            is_streaming: false,
            last_updated: 0,
            session_file_path: None,
            permission_mode: "default".to_string(),
        };

        assert_eq!(session_state.permission_mode, "default");
    }

    #[tokio_test]
    async fn test_session_type_identification() {
        // Test session type identification logic
        let claudio_id = "claudio-1234567890";
        assert!(claudio_id.starts_with(CLAUDIO_SESSION_PREFIX));

        let native_id = "d4e5f6g7-h8i9-j0k1-l2m3-n4o5p6q7r8s9";
        assert!(!native_id.starts_with(CLAUDIO_SESSION_PREFIX));

        let archived_id = "archived-session-123";
        assert!(!archived_id.starts_with(CLAUDIO_SESSION_PREFIX));
    }

    #[tokio_test]
    async fn test_message_count_calculation() {
        // Test message counting logic
        let messages = vec![
            serde_json::json!({"type": "user", "content": "Hello"}),
            serde_json::json!({"type": "assistant", "content": "Hi"}),
            serde_json::json!({"type": "user", "content": "Bye"}),
        ];

        let count = messages.len();
        assert_eq!(count, 3);

        // Test with empty messages
        let empty_messages: Vec<serde_json::Value> = Vec::new();
        assert_eq!(empty_messages.len(), 0);
    }

    #[tokio_test]
    async fn test_timestamp_generation() {
        let timestamp1 = chrono::Utc::now().timestamp_millis();
        tokio::time::sleep(std::time::Duration::from_millis(1)).await;
        let timestamp2 = chrono::Utc::now().timestamp_millis();

        assert!(timestamp2 > timestamp1);

        // Test RFC3339 format
        let rfc3339 = chrono::Utc::now().to_rfc3339();
        assert!(rfc3339.contains("T"));
        assert!(rfc3339.contains("Z"));
    }
}