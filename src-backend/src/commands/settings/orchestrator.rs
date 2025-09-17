use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{command, AppHandle, Emitter};
use uuid::Uuid;
use chrono;

use super::types::*;
use super::claudio_manager::ClaudioSettingsManager;
use super::claudecode_manager::ClaudeCodeSettingsManager;
use super::watchers::SettingsWatcherCoordinator;

/// Main orchestrator for all settings operations
/// FOLLOWS SESSIONORCHESTRATOR PATTERN EXACTLY BUT REMAINS SEPARATE
pub struct SettingsOrchestrator {
    handles: Arc<RwLock<HashMap<String, Arc<SettingsHandle>>>>,
    app_handle: AppHandle,

    // Settings-specific managers (NOT session managers)
    claudio_manager: Arc<ClaudioSettingsManager>,
    claudecode_manager: Arc<ClaudeCodeSettingsManager>,

    // Settings-specific watchers
    watcher_coordinator: Arc<SettingsWatcherCoordinator>,

    // Multiple projects can be active simultaneously
    active_projects: Arc<RwLock<HashMap<String, SettingsProjectContext>>>,
}

/// Context for tracking settings across multiple projects
struct SettingsProjectContext {
    handle_ids: Vec<String>,
    ref_count: usize,
    last_accessed: std::time::Instant,
}

impl SettingsOrchestrator {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            handles: Arc::new(RwLock::new(HashMap::new())),
            app_handle: app_handle.clone(),
            claudio_manager: Arc::new(ClaudioSettingsManager::new(app_handle.clone())),
            claudecode_manager: Arc::new(ClaudeCodeSettingsManager::new(app_handle.clone())),
            watcher_coordinator: Arc::new(SettingsWatcherCoordinator::new(app_handle.clone())),
            active_projects: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a settings handle (follows SessionOrchestrator pattern exactly)
    pub async fn get_settings_handle(
        &self,
        project_path: Option<String>,
        settings_type: SettingsType,
    ) -> Result<SettingsState, String> {
        let handle_id = format!("settings-{}", Uuid::new_v4());

        log::debug!("SettingsOrchestrator: get_settings_handle called with project_path={:?}, settings_type={:?}",
                   project_path, settings_type);

        // Start watchers if first subscriber to this project
        if let Some(path) = &project_path {
            self.watcher_coordinator
                .start_project_watchers_if_needed(path)
                .await?;

            // Update project context
            self.update_project_context(path.clone(), handle_id.clone()).await;
        }

        // Create handle
        let handle = Arc::new(SettingsHandle {
            settings_type: settings_type.clone(),
            project_path: project_path.clone(),
            last_updated: Arc::new(RwLock::new(chrono::Utc::now().timestamp_millis())),
        });

        // Store handle
        {
            let mut handles_guard = self.handles.write().await;
            handles_guard.insert(handle_id.clone(), handle.clone());
            log::debug!("Stored settings handle: {} (total: {})", handle_id, handles_guard.len());
        }

        // Get initial settings state
        self.get_settings_state(&handle_id, &settings_type, &project_path).await
    }

    async fn get_settings_state(
        &self,
        handle_id: &str,
        settings_type: &SettingsType,
        project_path: &Option<String>,
    ) -> Result<SettingsState, String> {
        let effective_settings = match settings_type {
            SettingsType::Claudio => {
                self.claudio_manager.get_settings().await?
            },
            SettingsType::ClaudeCode => {
                self.claudecode_manager
                    .get_effective_settings(project_path.as_deref())
                    .await?
            }
        };

        Ok(SettingsState {
            handle_id: handle_id.to_string(),
            settings_type: settings_type.clone(),
            project_path: project_path.clone(),
            effective_settings,
            last_updated: chrono::Utc::now().timestamp_millis(),
        })
    }

    /// Update setting with auto-save (follows session pattern)
    pub async fn update_setting(
        &self,
        handle_id: String,
        key: String,
        value: serde_json::Value,
        level: Option<SettingsLevel>, // For ClaudeCode only
    ) -> Result<(), String> {
        log::debug!("SettingsOrchestrator: update_setting called with handle_id={}, key={}", handle_id, key);

        let handle = {
            let handles_guard = self.handles.read().await;
            handles_guard.get(&handle_id)
                .ok_or_else(|| format!("Settings handle not found: {}", handle_id))?
                .clone()
        };

        match &handle.settings_type {
            SettingsType::Claudio => {
                self.claudio_manager.update_setting(key, value).await?;
            },
            SettingsType::ClaudeCode => {
                self.claudecode_manager.update_project_setting(
                    handle.project_path.as_deref(),
                    key,
                    value,
                    level.unwrap_or(SettingsLevel::Project)
                ).await?;
            }
        }

        // Update timestamp
        {
            let timestamp = chrono::Utc::now().timestamp_millis();
            let mut last_updated = handle.last_updated.write().await;
            *last_updated = timestamp;
        }

        // Emit update event
        self.emit_settings_update(&handle_id, &handle.settings_type, &handle.project_path).await;

        Ok(())
    }

    /// Get settings for a handle
    pub async fn get_settings_for_handle(&self, handle_id: String) -> Result<serde_json::Value, String> {
        let handle = {
            let handles_guard = self.handles.read().await;
            handles_guard.get(&handle_id)
                .ok_or_else(|| format!("Settings handle not found: {}", handle_id))?
                .clone()
        };

        match &handle.settings_type {
            SettingsType::Claudio => {
                self.claudio_manager.get_settings().await
            },
            SettingsType::ClaudeCode => {
                self.claudecode_manager
                    .get_effective_settings(handle.project_path.as_deref())
                    .await
            }
        }
    }

    /// Clean up handle when no longer needed
    pub async fn destroy_handle(&self, handle_id: String) -> Result<(), String> {
        log::debug!("SettingsOrchestrator: destroy_handle called for {}", handle_id);

        let removed_handle = {
            let mut handles_guard = self.handles.write().await;
            handles_guard.remove(&handle_id)
        };

        if let Some(handle) = removed_handle {
            // Update project context and stop watchers if last handle
            if let Some(project_path) = &handle.project_path {
                self.cleanup_project_context(project_path.clone(), handle_id).await;
            }
        }

        Ok(())
    }

    async fn update_project_context(&self, project_path: String, handle_id: String) {
        let mut projects_guard = self.active_projects.write().await;

        match projects_guard.get_mut(&project_path) {
            Some(context) => {
                context.handle_ids.push(handle_id);
                context.ref_count += 1;
                context.last_accessed = std::time::Instant::now();
            },
            None => {
                projects_guard.insert(project_path.clone(), SettingsProjectContext {
                    handle_ids: vec![handle_id],
                    ref_count: 1,
                    last_accessed: std::time::Instant::now(),
                });
            }
        }
    }

    async fn cleanup_project_context(&self, project_path: String, handle_id: String) {
        let mut projects_guard = self.active_projects.write().await;

        if let Some(context) = projects_guard.get_mut(&project_path) {
            context.handle_ids.retain(|id| id != &handle_id);
            context.ref_count = context.ref_count.saturating_sub(1);

            // If no more handles for this project, stop watchers and remove context
            if context.ref_count == 0 {
                projects_guard.remove(&project_path);

                // Stop watchers for this project
                if let Err(e) = self.watcher_coordinator.stop_project_watchers(&project_path).await {
                    log::error!("Failed to stop watchers for project {}: {}", project_path, e);
                }
            }
        }
    }

    async fn emit_settings_update(
        &self,
        handle_id: &str,
        settings_type: &SettingsType,
        project_path: &Option<String>,
    ) {
        // Get fresh settings
        if let Ok(updated_settings) = self.get_settings_for_handle(handle_id.to_string()).await {
            let event = SettingsUpdateEvent {
                handle_id: handle_id.to_string(),
                settings_type: settings_type.clone(),
                project_path: project_path.clone(),
                updated_settings,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };

            // Emit to frontend (same pattern as session messages)
            if let Err(e) = self.app_handle.emit("settings_update_stream", &event) {
                log::error!("Failed to emit settings update event: {}", e);
            } else {
                log::debug!("Emitted settings update for handle: {}", handle_id);
            }
        }
    }
}

// Global orchestrator instance (follows SessionOrchestrator pattern exactly)
use std::sync::OnceLock;
static GLOBAL_SETTINGS_ORCHESTRATOR: OnceLock<Arc<SettingsOrchestrator>> = OnceLock::new();

pub fn initialize_settings_orchestrator(app_handle: AppHandle) {
    let orchestrator = Arc::new(SettingsOrchestrator::new(app_handle));
    if GLOBAL_SETTINGS_ORCHESTRATOR.set(orchestrator).is_err() {
        panic!("SettingsOrchestrator already initialized");
    }
}

pub fn get_settings_orchestrator() -> Result<Arc<SettingsOrchestrator>, String> {
    GLOBAL_SETTINGS_ORCHESTRATOR
        .get()
        .ok_or_else(|| "SettingsOrchestrator not initialized".to_string())
        .cloned()
}

/// Tauri command: Create settings handle
#[command]
pub async fn create_settings_handle(
    project_path: Option<String>,
    settings_type: String,
) -> Result<String, String> {
    let settings_type = match settings_type.as_str() {
        "claudio" => SettingsType::Claudio,
        "claudecode" => SettingsType::ClaudeCode,
        _ => return Err(format!("Invalid settings type: {}", settings_type)),
    };

    let orchestrator = get_settings_orchestrator()?;
    let state = orchestrator.get_settings_handle(project_path, settings_type).await?;
    Ok(state.handle_id)
}

/// Tauri command: Get settings for handle
#[command]
pub async fn get_settings_for_handle(
    handle_id: String
) -> Result<serde_json::Value, String> {
    let orchestrator = get_settings_orchestrator()?;
    orchestrator.get_settings_for_handle(handle_id).await
}

/// Tauri command: Update setting for handle
#[command]
pub async fn update_setting_for_handle(
    handle_id: String,
    key: String,
    value: serde_json::Value,
    level: Option<String>,
) -> Result<(), String> {
    let settings_level = level.map(|l| match l.as_str() {
        "env" => SettingsLevel::Environment,
        "local" => SettingsLevel::Local,
        "project" => SettingsLevel::Project,
        "global" => SettingsLevel::Global,
        _ => SettingsLevel::Project, // Default
    });

    let orchestrator = get_settings_orchestrator()?;
    orchestrator.update_setting(handle_id, key, value, settings_level).await
}

/// Tauri command: Destroy settings handle
#[command]
pub async fn destroy_settings_handle(handle_id: String) -> Result<(), String> {
    let orchestrator = get_settings_orchestrator()?;
    orchestrator.destroy_handle(handle_id).await
}