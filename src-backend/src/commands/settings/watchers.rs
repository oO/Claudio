use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use std::time::Duration;
use std::path::Path;

use crate::paths::{
    claudio_settings_path,
    claude_global_settings_path,
    claude_project_settings_path,
    claude_project_local_settings_path,
    CLAUDE_SETTINGS_LOCAL_FILE
};

/// Coordinates file watchers for settings files across multiple projects
pub struct SettingsWatcherCoordinator {
    app_handle: AppHandle,
    active_watchers: Arc<RwLock<HashMap<String, SettingsWatcher>>>,
    project_ref_counts: Arc<RwLock<HashMap<String, usize>>>,
}

/// Individual watcher for a specific settings scope
struct SettingsWatcher {
    _watcher: RecommendedWatcher, // Keep alive
}


impl SettingsWatcherCoordinator {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            active_watchers: Arc::new(RwLock::new(HashMap::new())),
            project_ref_counts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start watchers for a project if not already active
    pub async fn start_project_watchers_if_needed(&self, project_path: &str) -> Result<(), String> {
        log::debug!("SettingsWatcherCoordinator: starting watchers for project: {}", project_path);

        // Increment ref count
        {
            let mut ref_counts = self.project_ref_counts.write().await;
            let count = ref_counts.entry(project_path.to_string()).or_insert(0);
            *count += 1;

            // If already watching, just return
            if *count > 1 {
                log::debug!("Project {} already being watched (ref count: {})", project_path, count);
                return Ok(());
            }
        }

        // Start all necessary watchers for this project
        self.start_claudio_global_watcher().await?;
        self.start_claude_global_watcher().await?;
        self.start_claude_project_watcher(project_path).await?;

        log::debug!("Successfully started all watchers for project: {}", project_path);
        Ok(())
    }

    /// Stop watchers for a project if ref count reaches zero
    pub async fn stop_project_watchers(&self, project_path: &str) -> Result<(), String> {
        log::debug!("SettingsWatcherCoordinator: stopping watchers for project: {}", project_path);

        // Decrement ref count
        let should_stop = {
            let mut ref_counts = self.project_ref_counts.write().await;
            if let Some(count) = ref_counts.get_mut(project_path) {
                *count = count.saturating_sub(1);
                let should_stop = *count == 0;
                if should_stop {
                    ref_counts.remove(project_path);
                }
                should_stop
            } else {
                false
            }
        };

        if should_stop {
            // Stop project-specific watchers
            let mut watchers = self.active_watchers.write().await;

            // Remove project-specific watchers
            let project_watcher_key = format!("claude_project_{}", project_path);
            if watchers.remove(&project_watcher_key).is_some() {
                log::debug!("Stopped Claude project watcher for: {}", project_path);
            }

            // Check if we should stop global watchers (if no other projects)
            let has_other_projects = {
                let ref_counts = self.project_ref_counts.read().await;
                !ref_counts.is_empty()
            };

            if !has_other_projects {
                watchers.remove("claudio_global");
                watchers.remove("claude_global");
                log::debug!("Stopped all global watchers (no more projects)");
            }
        }

        Ok(())
    }

    /// Start Claudio global settings watcher
    async fn start_claudio_global_watcher(&self) -> Result<(), String> {
        let watcher_key = "claudio_global".to_string();

        // Check if already exists
        {
            let watchers = self.active_watchers.read().await;
            if watchers.contains_key(&watcher_key) {
                return Ok(());
            }
        }

        let settings_path = claudio_settings_path()
            .map_err(|e| format!("Failed to get Claudio settings path: {}", e))?;

        let app_handle = self.app_handle.clone();
        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        if matches!(event.kind, EventKind::Modify(_)) {
                            log::debug!("Claudio settings file changed");
                            if let Err(e) = app_handle.emit("claudio_settings_changed", ()) {
                                log::error!("Failed to emit Claudio settings changed event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Claudio settings watcher error: {:?}", e);
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        ).map_err(|e| format!("Failed to create Claudio settings watcher: {}", e))?;

        // Watch the settings file or its parent directory
        let watch_path = if settings_path.exists() {
            settings_path.as_path()
        } else if let Some(parent) = settings_path.parent() {
            parent
        } else {
            return Err("Cannot determine watch path for Claudio settings".to_string());
        };

        // Start watching
        let mut watcher = watcher;
        watcher.watch(watch_path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to start watching Claudio settings: {}", e))?;

        // Store watcher
        {
            let mut watchers = self.active_watchers.write().await;
            watchers.insert(watcher_key, SettingsWatcher {
                _watcher: watcher,
            });
        }

        log::debug!("Started Claudio global settings watcher");
        Ok(())
    }

    /// Start Claude global settings watcher
    async fn start_claude_global_watcher(&self) -> Result<(), String> {
        let watcher_key = "claude_global".to_string();

        // Check if already exists
        {
            let watchers = self.active_watchers.read().await;
            if watchers.contains_key(&watcher_key) {
                return Ok(());
            }
        }

        let settings_path = claude_global_settings_path()
            .map_err(|e| format!("Failed to get Claude global settings path: {}", e))?;

        let app_handle = self.app_handle.clone();
        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        if matches!(event.kind, EventKind::Modify(_)) {
                            log::debug!("Claude global settings file changed");
                            if let Err(e) = app_handle.emit("claude_global_settings_changed", ()) {
                                log::error!("Failed to emit Claude global settings changed event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Claude global settings watcher error: {:?}", e);
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        ).map_err(|e| format!("Failed to create Claude global settings watcher: {}", e))?;

        // Watch the settings file or its parent directory
        let watch_path = if settings_path.exists() {
            settings_path.as_path()
        } else if let Some(parent) = settings_path.parent() {
            parent
        } else {
            return Err("Cannot determine watch path for Claude global settings".to_string());
        };

        // Start watching
        let mut watcher = watcher;
        watcher.watch(watch_path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to start watching Claude global settings: {}", e))?;

        // Store watcher
        {
            let mut watchers = self.active_watchers.write().await;
            watchers.insert(watcher_key, SettingsWatcher {
                _watcher: watcher,
            });
        }

        log::debug!("Started Claude global settings watcher");
        Ok(())
    }

    /// Start Claude project settings watcher (both project and local files)
    async fn start_claude_project_watcher(&self, project_path: &str) -> Result<(), String> {
        let watcher_key = format!("claude_project_{}", project_path);

        // Check if already exists
        {
            let watchers = self.active_watchers.read().await;
            if watchers.contains_key(&watcher_key) {
                return Ok(());
            }
        }

        let project_settings_path = claude_project_settings_path(Path::new(project_path));
        let _local_settings_path = claude_project_local_settings_path(Path::new(project_path));

        let app_handle = self.app_handle.clone();
        let project_path_clone = project_path.to_string();

        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                match res {
                    Ok(event) => {
                        if matches!(event.kind, EventKind::Modify(_)) {
                            // Check which file was modified
                            for path in &event.paths {
                                let filename = path.file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("");

                                match filename {
                                    "settings.json" => {
                                        log::debug!("Claude project settings file changed for: {}", project_path_clone);
                                        if let Err(e) = app_handle.emit("claude_project_settings_changed",
                                                                       serde_json::json!({ "project_path": project_path_clone })) {
                                            log::error!("Failed to emit Claude project settings changed event: {}", e);
                                        }
                                    }
                                    CLAUDE_SETTINGS_LOCAL_FILE => {
                                        log::debug!("Claude local settings file changed for: {}", project_path_clone);
                                        if let Err(e) = app_handle.emit("claude_local_settings_changed",
                                                                       serde_json::json!({ "project_path": project_path_clone })) {
                                            log::error!("Failed to emit Claude local settings changed event: {}", e);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Claude project settings watcher error: {:?}", e);
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        ).map_err(|e| format!("Failed to create Claude project settings watcher: {}", e))?;

        // Watch the .claude directory (covers both settings files)
        let claude_dir = project_settings_path.parent()
            .ok_or("Cannot get .claude directory")?;

        // Start watching
        let mut watcher = watcher;
        if claude_dir.exists() {
            watcher.watch(claude_dir, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Failed to start watching Claude project settings: {}", e))?;
        }

        // Store watcher
        {
            let mut watchers = self.active_watchers.write().await;
            watchers.insert(watcher_key, SettingsWatcher {
                _watcher: watcher,
            });
        }

        log::debug!("Started Claude project settings watcher for: {}", project_path);
        Ok(())
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tauri::test::{MockApp, mock_context};
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_ref_counting() {
        let app = MockApp::new(mock_context());
        let coordinator = SettingsWatcherCoordinator::new(app.handle().clone());

        let project_path = "/test/project";

        // Start watchers twice
        coordinator.start_project_watchers_if_needed(project_path).await.unwrap();
        coordinator.start_project_watchers_if_needed(project_path).await.unwrap();

        // Ref count should be 2
        {
            let ref_counts = coordinator.project_ref_counts.read().await;
            assert_eq!(ref_counts.get(project_path), Some(&2));
        }

        // Stop once - should still be active
        coordinator.stop_project_watchers(project_path).await.unwrap();
        {
            let ref_counts = coordinator.project_ref_counts.read().await;
            assert_eq!(ref_counts.get(project_path), Some(&1));
        }

        // Stop again - should be removed
        coordinator.stop_project_watchers(project_path).await.unwrap();
        {
            let ref_counts = coordinator.project_ref_counts.read().await;
            assert_eq!(ref_counts.get(project_path), None);
        }
    }
}