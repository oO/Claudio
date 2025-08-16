import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { PermissionRule } from "./useSettingsState";
import { logger } from '@/lib/logger';

/**
 * Project settings interface (base + local merge)
 * Handles both .claude/settings.json and .claude/settings.local.json
 */
export interface ProjectSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  // Add other common settings fields as needed
}

export interface ProjectSettingsFiles {
  base: ProjectSettings;
  local: ProjectSettings;
  merged: ProjectSettings;
}

export interface ProjectSettingsState {
  baseSettings: ProjectSettings;
  localSettings: ProjectSettings;
  mergedSettings: ProjectSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  localAllowRules: PermissionRule[];
  localDenyRules: PermissionRule[];
}

export interface ProjectSettingsActions {
  loadSettings: (projectPath: string) => Promise<void>;
  saveLocalSettings: (projectPath: string) => Promise<void>;
  addLocalPermissionRule: (type: "allow" | "deny") => void;
  updateLocalPermissionRule: (type: "allow" | "deny", id: string, value: string) => void;
  removeLocalPermissionRule: (type: "allow" | "deny", id: string) => void;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing project settings from both base and local files
 * Reads from .claude/settings.json (base) and .claude/settings.local.json (local)
 */
export const useLocalProjectSettings = (
  onSaveComplete?: (success: boolean, message: string) => void
): ProjectSettingsState & ProjectSettingsActions => {
  const [baseSettings, setBaseSettings] = useState<ProjectSettings>({});
  const [localSettings, setLocalSettings] = useState<ProjectSettings>({});
  const [mergedSettings, setMergedSettings] = useState<ProjectSettings>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  const [localAllowRules, setLocalAllowRules] = useState<PermissionRule[]>([]);
  const [localDenyRules, setLocalDenyRules] = useState<PermissionRule[]>([]);

  /**
   * Merges base and local settings with local taking precedence
   */
  const mergeSettings = useCallback((base: ProjectSettings, local: ProjectSettings): ProjectSettings => {
    const merged: ProjectSettings = { ...base };
    
    // Merge permissions - local overrides base completely for each type
    if (local.permissions || base.permissions) {
      merged.permissions = {
        allow: local.permissions?.allow || base.permissions?.allow || [],
        deny: local.permissions?.deny || base.permissions?.deny || [],
      };
    }
    
    return merged;
  }, []);

  /**
   * Loads project settings from both base (.claude/settings.json) and local (.claude/settings.local.json) files
   */
  const loadSettings = useCallback(async (projectPath: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const baseSettingsPath = `${projectPath}/.claude/settings.json`;
      const localSettingsPath = `${projectPath}/.claude/settings.local.json`;
      
      let baseSettings: ProjectSettings = {};
      let localSettings: ProjectSettings = {};
      
      // Load base settings
      try {
        const baseContent = await api.readClaudeMdFile(baseSettingsPath);
        baseSettings = JSON.parse(baseContent);
      } catch (err) {
        logger.log("Base settings file doesn't exist, using empty settings");
        baseSettings = {};
      }
      
      // Load local settings
      try {
        const localContent = await api.readClaudeMdFile(localSettingsPath);
        localSettings = JSON.parse(localContent);
      } catch (err) {
        logger.log("Local settings file doesn't exist, using empty settings");
        localSettings = {};
      }
      
      // Update state
      setBaseSettings(baseSettings);
      setLocalSettings(localSettings);
      
      // Merge settings
      const merged = mergeSettings(baseSettings, localSettings);
      setMergedSettings(merged);

      // Parse base permissions for display
      if (baseSettings.permissions) {
        setAllowRules(
          (baseSettings.permissions.allow || []).map((rule: string, index: number) => ({
            id: `base-allow-${index}`,
            value: rule,
          }))
        );
        setDenyRules(
          (baseSettings.permissions.deny || []).map((rule: string, index: number) => ({
            id: `base-deny-${index}`,
            value: rule,
          }))
        );
      } else {
        setAllowRules([]);
        setDenyRules([]);
      }

      // Parse local permissions for editing
      if (localSettings.permissions) {
        setLocalAllowRules(
          (localSettings.permissions.allow || []).map((rule: string, index: number) => ({
            id: `local-allow-${index}`,
            value: rule,
          }))
        );
        setLocalDenyRules(
          (localSettings.permissions.deny || []).map((rule: string, index: number) => ({
            id: `local-deny-${index}`,
            value: rule,
          }))
        );
      } else {
        setLocalAllowRules([]);
        setLocalDenyRules([]);
      }
    } catch (err) {
      logger.error("Failed to load project settings:", err);
      setError("Failed to load project settings.");
      setBaseSettings({});
      setLocalSettings({});
      setMergedSettings({});
      setAllowRules([]);
      setDenyRules([]);
      setLocalAllowRules([]);
      setLocalDenyRules([]);
    } finally {
      setLoading(false);
    }
  }, [mergeSettings]);

  /**
   * Saves the current local settings to .claude/settings.local.json
   */
  const saveLocalSettings = async (projectPath: string) => {
    try {
      setSaving(true);
      setError(null);

      const localSettingsPath = `${projectPath}/.claude/settings.local.json`;
      
      // Build the local settings object from current local rules
      const updatedLocalSettings: ProjectSettings = {
        permissions: {
          allow: localAllowRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          deny: localDenyRules.map(rule => rule.value).filter(v => v && String(v).trim()),
        },
      };

      // Save to file
      await api.saveClaudeMdFile(localSettingsPath, JSON.stringify(updatedLocalSettings, null, 2));
      setLocalSettings(updatedLocalSettings);
      
      // Update merged settings
      const merged = mergeSettings(baseSettings, updatedLocalSettings);
      setMergedSettings(merged);

      onSaveComplete?.(true, "Local settings saved successfully!");
    } catch (err) {
      logger.error("Failed to save local settings:", err);
      setError("Failed to save local project settings.");
      onSaveComplete?.(false, "Failed to save local settings");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Adds a new local permission rule (only affects .claude/settings.local.json)
   */
  const addLocalPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `local-${type}-${Date.now()}`,
      value: "",
    };
    
    if (type === "allow") {
      setLocalAllowRules(prev => [...prev, newRule]);
    } else {
      setLocalDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a local permission rule
   */
  const updateLocalPermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setLocalAllowRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setLocalDenyRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a local permission rule
   */
  const removeLocalPermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setLocalAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setLocalDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  return {
    // State
    baseSettings,
    localSettings,
    mergedSettings,
    loading,
    saving,
    error,
    allowRules,        // Base rules for display
    denyRules,         // Base rules for display
    localAllowRules,   // Local rules for editing
    localDenyRules,    // Local rules for editing
    
    // Actions
    loadSettings,
    saveLocalSettings,
    addLocalPermissionRule,
    updateLocalPermissionRule,
    removeLocalPermissionRule,
    setError,
  };
};