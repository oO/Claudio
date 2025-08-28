use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{command, AppHandle, Emitter};
use uuid::Uuid;
use chrono;

use crate::commands::claudio_storage::{
    get_claudio_session,
};
use crate::commands::claude_direct::{start_claude_direct_session, ClaudeDirectOptions};
use crate::commands::claude::{SessionFileEvent, SessionWatcherState};
use tokio::sync::broadcast;

/// Types of sessions that can be managed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SessionType {
    /// Interactive Claudio session that manages multiple native sessions
    Claudio { claudio_id: Option<String> },
    /// Read-only native Claude Code session
    Native { session_id: String },
}

/// Current state of a session handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub handle_id: String,
    pub session_type: SessionType,
    pub project_path: String,
    pub current_claude_session_id: Option<String>,
    pub message_count: usize,
    pub is_streaming: bool,
    pub last_updated: i64,
    pub session_file_path: Option<String>,
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
            }
        }
    }

    /// Internal method to handle Claudio session prompts
    async fn send_claudio_prompt(&self, claudio_id: Option<&str>, prompt: String) -> Result<(), String> {
        // Get current Claude session ID for --resume (if any)
        let current_claude_session = {
            let guard = self.current_claude_session.read().await;
            guard.clone()
        };

        // Generate real claudio_id if this is a new session
        let actual_claudio_id = match claudio_id {
            Some(id) => id.to_string(),
            None => {
                // First prompt for new session - generate real claudio_id
                format!("claudio-{}", chrono::Utc::now().timestamp_millis())
            }
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

        // After Claude completes, find the most recent session file for this project
        // This is needed to track which session ID is now active
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
        let project_encoded = self.project_path.replace("/", "-");
        let session_file_path = claude_dir
            .join("projects")
            .join(project_encoded)
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
        let project_id = self.project_path.replace("/", "-");
        
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
                
        log::info!("Started message streaming for session handle: {}", self.handle_id);
        
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
                            let current_session = {
                                let guard = current_claude_session.read().await;
                                guard.clone()
                            };
                            
                            if let Some(current_session_id) = current_session {
                                if session_id == &current_session_id {
                                    // This is our tracked session - process new messages
                                    log::info!("📥 Processing file change for tracked session: {}", session_id);
                                    if let Err(e) = Self::process_new_messages(
                                        &handle_id,
                                        session_id,
                                        &project_id,
                                        &app_handle,
                                        &last_processed_count,
                                    ).await {
                                        log::error!("Failed to process new messages for handle {}: {}", handle_id, e);
                                    }
                                } else {
                                    log::debug!("🔇 Ignoring file change for session {} (tracking {})", session_id, current_session_id);
                                }
                            } else {
                                log::debug!("🔇 Ignoring file change for session {} (no current session tracked)", session_id);
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
        
        // Check how many messages we've already processed
        let last_count = {
            let guard = last_processed_count.read().await;
            *guard
        };
        
        // Only emit new messages
        if all_messages.len() > last_count {
            let new_messages = &all_messages[last_count..];
            log::info!("Found {} new messages in session {} for handle {}", 
                      new_messages.len(), session_id, handle_id);
            
            // Emit each new message
            for message in new_messages {
                let streamed_message = StreamedMessage {
                    handle_id: handle_id.to_string(),
                    message_type: message.get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    content: message.clone(),
                    uuid: message.get("uuid")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                };
                
                // Emit to frontend
                log::info!("🚀 Emitting streamed message to frontend: handle={}, type={}, uuid={}", 
                          handle_id, streamed_message.message_type, streamed_message.uuid);
                if let Err(e) = app_handle.emit("session_message_stream", &streamed_message) {
                    log::error!("❌ Failed to emit message stream event: {}", e);
                } else {
                    log::debug!("✅ Successfully emitted message stream event");
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
        let project_encoded = project_path.replace("/", "-");
        let project_sessions_dir = claude_dir.join("projects").join(&project_encoded);
        
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
            let old_session = guard.clone();
            *guard = Some(session_id.clone());
            
            if old_session != Some(session_id.clone()) {
                log::info!("Updated current Claude session from {:?} to {}", old_session, session_id);
            }
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

    /// Get or create a session handle
    pub async fn get_session_handle(&self, session_identifier: Option<String>, project_path: String) -> Result<SessionState, String> {
        // Determine session type and handle ID based on identifier
        let (session_type, handle_id) = match session_identifier {
            Some(id) => {
                let session_type = if id.starts_with("claudio-") {
                    SessionType::Claudio { claudio_id: Some(id.clone()) }
                } else {
                    SessionType::Native { session_id: id.clone() }
                };
                (session_type, id)
            },
            None => {
                // New session - no claudio_id yet, generate temporary handle ID for storage
                let temp_handle_id = format!("new-session-{}", uuid::Uuid::new_v4());
                (SessionType::Claudio { claudio_id: None }, temp_handle_id)
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
                            *guard = claudio_session.session_id;
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
                log::info!("Set current Claude session for native session: {}", session_id);
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
        }

        // Set up message streaming for this handle
        if let Err(e) = handle.start_message_streaming(&self.session_watcher_state).await {
            log::error!("Failed to start message streaming for handle {}: {}", handle_id, e);
        }

        self.get_session_state(&handle_id, &session_type, &project_path).await
    }

    async fn get_session_state(&self, handle_id: &str, session_type: &SessionType, project_path: &str) -> Result<SessionState, String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(handle_id)
            .ok_or_else(|| "Session handle not found".to_string())?;

        let current_claude_session_id = {
            let guard = handle.current_claude_session.read().await;
            guard.clone()
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
            let claude_dir = PathBuf::from(&project_path)
                .join(".claude")
                .join("projects")
                .join(PathBuf::from(&project_path).file_name().unwrap_or_default());
            let session_file_path = claude_dir.join(format!("{}.jsonl", claude_session_id));
            Some(session_file_path.to_string_lossy().to_string())
        } else {
            None
        };

        Ok(SessionState {
            handle_id: handle_id.to_string(),
            session_type: session_type.clone(),
            project_path: project_path.to_string(),
            current_claude_session_id,
            message_count,
            is_streaming: false, // TODO: Track streaming state
            last_updated: chrono::Utc::now().timestamp_millis(),
            session_file_path,
        })
    }

    /// Send prompt to a session handle
    pub async fn send_prompt_to_handle(&self, handle_id: String, prompt: String) -> Result<(), String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(&handle_id)
            .ok_or_else(|| "Session handle not found".to_string())?;

        handle.send_prompt(prompt).await
    }

    /// Get messages for a session handle
    pub async fn get_handle_messages(&self, handle_id: String) -> Result<Vec<serde_json::Value>, String> {
        let handles_guard = self.handles.read().await;
        let handle = handles_guard.get(&handle_id)
            .ok_or_else(|| "Session handle not found".to_string())?;

        handle.get_message_history().await
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
    log::info!("🎯 SessionOrchestrator: get_session_handle called with session_id={:?}, project_path={}", session_id, project_path);
    
    let orchestrator = match get_orchestrator() {
        Ok(orch) => {
            log::info!("✅ SessionOrchestrator: Retrieved orchestrator successfully");
            orch
        },
        Err(e) => {
            log::error!("❌ SessionOrchestrator: Failed to get orchestrator: {}", e);
            return Err(e);
        }
    };
    
    match orchestrator.get_session_handle(session_id.clone(), project_path.clone()).await {
        Ok(state) => {
            log::info!("✅ SessionOrchestrator: Created session handle successfully: {:?}", session_id);
            Ok(state)
        },
        Err(e) => {
            log::error!("❌ SessionOrchestrator: Failed to create session handle: {} (session_id={:?}, project_path={})", e, session_id, project_path);
            Err(e)
        }
    }
}

/// Tauri command: Send prompt to session
#[command]
pub async fn send_session_prompt(handle_id: String, prompt: String) -> Result<(), String> {
    let orchestrator = get_orchestrator()?;
    orchestrator.send_prompt_to_handle(handle_id, prompt).await
}

/// Tauri command: Get session messages
#[command]
pub async fn get_session_messages(handle_id: String) -> Result<Vec<serde_json::Value>, String> {
    log::info!("🔍 SessionOrchestrator: get_session_messages called with handle_id={}", handle_id);
    
    let orchestrator = match get_orchestrator() {
        Ok(orch) => {
            log::info!("✅ SessionOrchestrator: Retrieved orchestrator for get_session_messages");
            orch
        },
        Err(e) => {
            log::error!("❌ SessionOrchestrator: Failed to get orchestrator for get_session_messages: {}", e);
            return Err(e);
        }
    };
    
    match orchestrator.get_handle_messages(handle_id.clone()).await {
        Ok(messages) => {
            log::info!("✅ SessionOrchestrator: Retrieved {} messages for handle {}", messages.len(), handle_id);
            Ok(messages)
        },
        Err(e) => {
            log::error!("❌ SessionOrchestrator: Failed to get messages for handle {}: {}", handle_id, e);
            Err(e)
        }
    }
}