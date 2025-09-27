// ============================================================================
// CLAUDE CODE SETTINGS ORCHESTRATOR SYSTEM
// ============================================================================
// This file handles settings that are SHARED between our Claudio app and
// Anthropic's Claude Code binary. Both applications can read/write these files.
//
// Settings include: model config, permissions, API keys, project settings
// File locations:
//   - ~/.claude/settings.json (global Claude Code settings)
//   - project/.claude/settings.json (project shared settings)
//   - project/.claude/settings.local.json (project local settings)
//
// Complex model: watchers, orchestration, handles, caching
// Required because both apps can modify files simultaneously
// ============================================================================

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{command, AppHandle, Emitter, Runtime};
use uuid::Uuid;
use chrono;

use super::types::*;
// Claude Code settings manager for shared .claude/ configuration files
use super::claudecode_manager::ClaudeCodeSettingsManager;
use super::watchers::SettingsWatcherCoordinator;

/// Main Claude Code settings manager with handle-based access and file watchers
/// Manages shared .claude/ configuration files with multi-level precedence
pub struct ClaudeCodeManager<R: Runtime> {
    handles: Arc<RwLock<HashMap<String, Arc<SettingsHandle>>>>,
    app_handle: AppHandle<R>,

    // Claude Code settings manager with file watchers
    claudecode_manager: Arc<ClaudeCodeSettingsManager<R>>,

    // Settings-specific watchers
    watcher_coordinator: Arc<SettingsWatcherCoordinator<R>>,

    // Multiple projects can be active simultaneously
    active_projects: Arc<RwLock<HashMap<String, SettingsProjectContext>>>,
}

/// Context for tracking settings across multiple projects
struct SettingsProjectContext {
    handle_ids: Vec<String>,
    ref_count: usize,
    last_accessed: std::time::Instant,
}

impl<R: Runtime> ClaudeCodeManager<R> {
    pub fn new(app_handle: AppHandle<R>) -> Self {
        Self {
            handles: Arc::new(RwLock::new(HashMap::new())),
            app_handle: app_handle.clone(),
            // Only Claude Code settings use the orchestrator system
            claudecode_manager: Arc::new(ClaudeCodeSettingsManager::new(app_handle.clone())),
            watcher_coordinator: Arc::new(SettingsWatcherCoordinator::new(app_handle.clone())),
            active_projects: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a Claude Code settings handle
    pub async fn get_settings_handle(
        &self,
        project_path: Option<String>,
    ) -> Result<SettingsState, String> {
        let handle_id = format!("settings-{}", Uuid::new_v4());

        log::debug!("SettingsOrchestrator: get_settings_handle called with project_path={:?}",
                   project_path);

        // Start watchers if first subscriber to this project
        if let Some(path) = &project_path {
            self.watcher_coordinator
                .start_project_watchers_if_needed(path)
                .await?;

            // Update project context
            self.update_project_context(path.clone(), handle_id.clone()).await;
        }

        // Create handle (always Claude Code settings)
        let handle = Arc::new(SettingsHandle {
            settings_type: SettingsType::ClaudeCode,
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
        self.get_settings_state(&handle_id, &project_path).await
    }

    async fn get_settings_state(
        &self,
        handle_id: &str,
        project_path: &Option<String>,
    ) -> Result<SettingsState, String> {
        let effective_settings = self.claudecode_manager
            .get_effective_settings(project_path.as_deref())
            .await?;

        Ok(SettingsState {
            handle_id: handle_id.to_string(),
            settings_type: SettingsType::ClaudeCode,
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

        // Always Claude Code settings
        self.claudecode_manager.update_project_setting(
            handle.project_path.as_deref(),
            key,
            value,
            level.unwrap_or(SettingsLevel::Project)
        ).await?;

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

        // Always Claude Code settings
        self.claudecode_manager
            .get_effective_settings(handle.project_path.as_deref())
            .await
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

// Global Claude Code settings manager instance
use std::sync::OnceLock;

type ClaudeCodeManagerType = ClaudeCodeManager<tauri::Wry>;
static GLOBAL_CLAUDE_CODE_MANAGER: OnceLock<Arc<ClaudeCodeManagerType>> = OnceLock::new();

pub fn initialize_claude_code_settings_manager(app_handle: AppHandle) {
    let manager = Arc::new(ClaudeCodeManager::new(app_handle));
    if GLOBAL_CLAUDE_CODE_MANAGER.set(manager).is_err() {
        panic!("ClaudeCodeManager already initialized");
    }
}

pub fn get_claude_code_settings_manager() -> Result<Arc<ClaudeCodeManagerType>, String> {
    GLOBAL_CLAUDE_CODE_MANAGER
        .get()
        .ok_or_else(|| "ClaudeCodeManager not initialized".to_string())
        .cloned()
}

/// Tauri command: Create Claude Code settings handle
#[command]
pub async fn create_settings_handle(
    project_path: Option<String>,
) -> Result<String, String> {
    let manager = get_claude_code_settings_manager()?;
    let state = manager.get_settings_handle(project_path).await?;
    Ok(state.handle_id)
}

/// Tauri command: Get settings for handle
#[command]
pub async fn get_settings_for_handle(
    handle_id: String
) -> Result<serde_json::Value, String> {
    let manager = get_claude_code_settings_manager()?;
    manager.get_settings_for_handle(handle_id).await
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

    let manager = get_claude_code_settings_manager()?;
    manager.update_setting(handle_id, key, value, settings_level).await
}

/// Tauri command: Destroy settings handle
#[command]
pub async fn destroy_settings_handle(handle_id: String) -> Result<(), String> {
    let manager = get_claude_code_settings_manager()?;
    manager.destroy_handle(handle_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tauri::test::mock_app;
    use std::fs;
    use tokio::time::{sleep, Duration};

    /// Helper to create test manager and app
    async fn create_test_setup() -> (Arc<ClaudeCodeManager>, TempDir) {
        let app = mock_app();
        let manager = Arc::new(ClaudeCodeManager::new(app.handle().clone()));
        let temp_dir = TempDir::new().unwrap();
        (manager, temp_dir)
    }

    /// Helper to setup temp settings files
    fn setup_settings_file(path: &std::path::Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[tokio::test]
    async fn test_handle_creation_and_destruction() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create handle
        let state = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();
        assert!(state.handle_id.starts_with("settings-"));
        assert_eq!(state.settings_type, SettingsType::ClaudeCode);
        assert_eq!(state.project_path, Some(project_path.to_string()));

        // Verify handle is stored
        {
            let handles = manager.handles.read().await;
            assert!(handles.contains_key(&state.handle_id));
        }

        // Destroy handle
        manager.destroy_handle(state.handle_id.clone()).await.unwrap();

        // Verify handle is removed
        {
            let handles = manager.handles.read().await;
            assert!(!handles.contains_key(&state.handle_id));
        }
    }

    #[tokio::test]
    async fn test_settings_update_through_handle() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create handle
        let state = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Update setting through handle
        manager.update_setting(
            state.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("opus".to_string()),
            Some(SettingsLevel::Project)
        ).await.unwrap();

        // Verify setting was updated
        let settings = manager.get_settings_for_handle(state.handle_id).await.unwrap();
        assert_eq!(settings["effective"]["model"], "opus");
    }

    #[tokio::test]
    async fn test_multiple_handles_same_project() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create multiple handles for same project
        let state1 = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();
        let state2 = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Both should be different handles
        assert_ne!(state1.handle_id, state2.handle_id);
        assert_eq!(state1.project_path, state2.project_path);

        // Update through one handle
        manager.update_setting(
            state1.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("sonnet".to_string()),
            Some(SettingsLevel::Project)
        ).await.unwrap();

        // Both handles should see the update
        let settings1 = manager.get_settings_for_handle(state1.handle_id).await.unwrap();
        let settings2 = manager.get_settings_for_handle(state2.handle_id).await.unwrap();

        assert_eq!(settings1["effective"]["model"], "sonnet");
        assert_eq!(settings2["effective"]["model"], "sonnet");
    }

    #[tokio::test]
    async fn test_project_context_management() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Initially no project context
        {
            let projects = manager.active_projects.read().await;
            assert!(projects.is_empty());
        }

        // Create first handle
        let state1 = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Should create project context
        {
            let projects = manager.active_projects.read().await;
            let context = projects.get(project_path).unwrap();
            assert_eq!(context.ref_count, 1);
            assert_eq!(context.handle_ids.len(), 1);
            assert!(context.handle_ids.contains(&state1.handle_id));
        }

        // Create second handle
        let state2 = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Should update project context
        {
            let projects = manager.active_projects.read().await;
            let context = projects.get(project_path).unwrap();
            assert_eq!(context.ref_count, 2);
            assert_eq!(context.handle_ids.len(), 2);
            assert!(context.handle_ids.contains(&state1.handle_id));
            assert!(context.handle_ids.contains(&state2.handle_id));
        }

        // Destroy first handle
        manager.destroy_handle(state1.handle_id.clone()).await.unwrap();

        // Should update but not remove project context
        {
            let projects = manager.active_projects.read().await;
            let context = projects.get(project_path).unwrap();
            assert_eq!(context.ref_count, 1);
            assert_eq!(context.handle_ids.len(), 1);
            assert!(!context.handle_ids.contains(&state1.handle_id));
            assert!(context.handle_ids.contains(&state2.handle_id));
        }

        // Destroy second handle
        manager.destroy_handle(state2.handle_id).await.unwrap();

        // Should remove project context completely
        {
            let projects = manager.active_projects.read().await;
            assert!(!projects.contains_key(project_path));
        }
    }

    #[tokio::test]
    async fn test_multiple_projects() {
        let (manager, temp_dir) = create_test_setup().await;
        let project1_path = temp_dir.path().join("project1").to_str().unwrap().to_string();
        let project2_path = temp_dir.path().join("project2").to_str().unwrap().to_string();

        // Create handles for different projects
        let state1 = manager.get_settings_handle(Some(project1_path.clone())).await.unwrap();
        let state2 = manager.get_settings_handle(Some(project2_path.clone())).await.unwrap();

        // Both projects should be tracked
        {
            let projects = manager.active_projects.read().await;
            assert!(projects.contains_key(&project1_path));
            assert!(projects.contains_key(&project2_path));
        }

        // Update settings in each project
        manager.update_setting(
            state1.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("project1-model".to_string()),
            Some(SettingsLevel::Project)
        ).await.unwrap();

        manager.update_setting(
            state2.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("project2-model".to_string()),
            Some(SettingsLevel::Project)
        ).await.unwrap();

        // Settings should be isolated
        let settings1 = manager.get_settings_for_handle(state1.handle_id).await.unwrap();
        let settings2 = manager.get_settings_for_handle(state2.handle_id).await.unwrap();

        assert_eq!(settings1["effective"]["model"], "project1-model");
        assert_eq!(settings2["effective"]["model"], "project2-model");
    }

    #[tokio::test]
    async fn test_global_settings_handle() {
        let (manager, _temp_dir) = create_test_setup().await;

        // Create global handle (no project path)
        let state = manager.get_settings_handle(None).await.unwrap();
        assert_eq!(state.project_path, None);

        // Update global setting
        manager.update_setting(
            state.handle_id.clone(),
            "global_setting".to_string(),
            serde_json::Value::String("global_value".to_string()),
            Some(SettingsLevel::Global)
        ).await.unwrap();

        // Verify global setting
        let settings = manager.get_settings_for_handle(state.handle_id).await.unwrap();
        assert_eq!(settings["effective"]["global_setting"], "global_value");
    }

    #[tokio::test]
    async fn test_handle_validation() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Test invalid handle ID
        let result = manager.get_settings_for_handle("invalid-handle".to_string()).await;
        assert!(result.is_err());
        assert!(result.err().unwrap().contains("Settings handle not found"));

        // Test update with invalid handle
        let result = manager.update_setting(
            "invalid-handle".to_string(),
            "model".to_string(),
            serde_json::Value::String("test".to_string()),
            Some(SettingsLevel::Project)
        ).await;
        assert!(result.is_err());
        assert!(result.err().unwrap().contains("Settings handle not found"));

        // Test destroy invalid handle
        let result = manager.destroy_handle("invalid-handle".to_string()).await;
        assert!(result.is_ok()); // Should not error, just be a no-op
    }

    #[tokio::test]
    async fn test_concurrent_handle_operations() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        let mut handles = vec![];

        // Create multiple handles concurrently
        for i in 0..10 {
            let manager_clone = manager.clone();
            let project_path_clone = project_path.to_string();

            let handle = tokio::spawn(async move {
                let state = manager_clone.get_settings_handle(Some(project_path_clone)).await.unwrap();

                // Update a unique setting
                manager_clone.update_setting(
                    state.handle_id.clone(),
                    format!("setting_{}", i),
                    serde_json::Value::String(format!("value_{}", i)),
                    Some(SettingsLevel::Project)
                ).await.unwrap();

                state.handle_id
            });
            handles.push(handle);
        }

        // Wait for all operations to complete
        let mut handle_ids = vec![];
        for handle in handles {
            let handle_id = handle.await.unwrap();
            handle_ids.push(handle_id);
        }

        // Verify all settings were applied
        let first_handle = &handle_ids[0];
        let settings = manager.get_settings_for_handle(first_handle.clone()).await.unwrap();

        for i in 0..10 {
            assert_eq!(
                settings["effective"][format!("setting_{}", i)],
                format!("value_{}", i)
            );
        }

        // Clean up all handles
        for handle_id in handle_ids {
            manager.destroy_handle(handle_id).await.unwrap();
        }

        // Project context should be cleaned up
        {
            let projects = manager.active_projects.read().await;
            assert!(!projects.contains_key(project_path));
        }
    }

    #[tokio::test]
    async fn test_timestamp_updates() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create handle
        let state = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();
        let initial_timestamp = state.last_updated;

        // Wait a bit
        sleep(Duration::from_millis(10)).await;

        // Update setting
        manager.update_setting(
            state.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("test".to_string()),
            Some(SettingsLevel::Project)
        ).await.unwrap();

        // Get handle again to check timestamp
        let handle = {
            let handles = manager.handles.read().await;
            handles.get(&state.handle_id).unwrap().clone()
        };

        let updated_timestamp = {
            let timestamp = handle.last_updated.read().await;
            *timestamp
        };

        // Timestamp should be updated
        assert!(updated_timestamp > initial_timestamp);
    }

    #[tokio::test]
    async fn test_settings_level_defaulting() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create handle
        let state = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Update setting without specifying level (should default to Project)
        manager.update_setting(
            state.handle_id.clone(),
            "model".to_string(),
            serde_json::Value::String("default-level".to_string()),
            None
        ).await.unwrap();

        // Verify setting was applied at project level
        let settings = manager.get_settings_for_handle(state.handle_id).await.unwrap();
        assert_eq!(settings["effective"]["model"], "default-level");
        assert_eq!(settings["layers"]["project"]["model"], "default-level");
    }

    #[tokio::test]
    async fn test_watcher_coordination() {
        let (manager, temp_dir) = create_test_setup().await;
        let project_path = temp_dir.path().to_str().unwrap();

        // Create handle - should start watchers
        let state = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Verify project context was created
        {
            let projects = manager.active_projects.read().await;
            assert!(projects.contains_key(project_path));
        }

        // Create second handle for same project - should not duplicate watchers
        let state2 = manager.get_settings_handle(Some(project_path.to_string())).await.unwrap();

        // Verify ref count increased
        {
            let projects = manager.active_projects.read().await;
            let context = projects.get(project_path).unwrap();
            assert_eq!(context.ref_count, 2);
        }

        // Destroy first handle
        manager.destroy_handle(state.handle_id).await.unwrap();

        // Context should remain (still has one handle)
        {
            let projects = manager.active_projects.read().await;
            let context = projects.get(project_path).unwrap();
            assert_eq!(context.ref_count, 1);
        }

        // Destroy second handle
        manager.destroy_handle(state2.handle_id).await.unwrap();

        // Context should be completely removed
        {
            let projects = manager.active_projects.read().await;
            assert!(!projects.contains_key(project_path));
        }
    }
}