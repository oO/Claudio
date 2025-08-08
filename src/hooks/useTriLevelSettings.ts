import React, { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

/**
 * Represents a permission rule that can exist at multiple levels
 */
export interface TriLevelRule {
  id: string;
  value: string;
  type: "allow" | "deny";
  levels: {
    user: boolean;     // ~/.claude/settings.json
    team: boolean;     // <project>/.claude/settings.json  
    local: boolean;    // <project>/.claude/settings.local.json
  };
}

/**
 * Settings structure for each level
 */
interface SettingsLevel {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

export interface TriLevelSettingsState {
  loading: boolean;
  saving: boolean;
  error: string | null;
  rules: TriLevelRule[];
}

export interface TriLevelSettingsActions {
  loadSettings: (projectPath: string) => Promise<void>;
  addRule: (type: "allow" | "deny", value: string) => void;
  toggleRuleLevel: (ruleId: string, level: "user" | "team" | "local") => Promise<void>;
  updateRuleValue: (ruleId: string, value: string) => void;
  deleteRule: (ruleId: string) => Promise<void>;
  saveAllLevels: (projectPath: string) => Promise<void>;
}

/**
 * Hook for managing permission rules across all 3 settings levels
 * Provides a unified interface for user, team, and local project settings
 */
export const useTriLevelSettings = (
  onSaveComplete?: (success: boolean, message: string) => void
): TriLevelSettingsState & TriLevelSettingsActions => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<TriLevelRule[]>([]);

  // Store current settings for each level
  const [userSettings, setUserSettings] = useState<SettingsLevel>({});
  const [teamSettings, setTeamSettings] = useState<SettingsLevel>({});
  const [localSettings, setLocalSettings] = useState<SettingsLevel>({});

  /**
   * Loads settings from all 3 levels and merges them into unified rules
   */
  const loadSettings = useCallback(async (projectPath: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Load user settings (~/.claude/settings.json)
      let userSettings: SettingsLevel = {};
      try {
        const userSettingsData = await api.getClaudeSettings();
        userSettings = userSettingsData.data || {};
      } catch (err) {
        console.log("User settings not found, using empty settings");
      }
      
      // Load team settings (<project>/.claude/settings.json)
      let teamSettings: SettingsLevel = {};
      try {
        const teamSettingsPath = `${projectPath}/.claude/settings.json`;
        const teamContent = await api.readClaudeMdFile(teamSettingsPath);
        teamSettings = JSON.parse(teamContent);
        console.log("✅ Team settings loaded successfully from:", teamSettingsPath);
      } catch (err) {
        console.log("⚠️ Team settings not found, using empty settings. Error:", err);
      }
      
      // Load local settings (<project>/.claude/settings.local.json)
      let localSettings: SettingsLevel = {};
      try {
        const localSettingsPath = `${projectPath}/.claude/settings.local.json`;
        const localContent = await api.readClaudeMdFile(localSettingsPath);
        localSettings = JSON.parse(localContent);
        console.log("✅ Local settings loaded successfully from:", localSettingsPath);
        console.log("  Local content:", localContent);
        console.log("  Parsed local settings:", localSettings);
      } catch (err) {
        console.log("⚠️ Local settings not found, using empty settings. Error:", err);
      }
      
      // Store settings for later saving
      setUserSettings(userSettings);
      setTeamSettings(teamSettings);
      setLocalSettings(localSettings);
      
      // Merge all rules from all levels
      const mergedRules = mergeRulesFromAllLevels(userSettings, teamSettings, localSettings);
      setRules(mergedRules);
      
    } catch (err) {
      console.error("Failed to load tri-level settings:", err);
      setError("Failed to load settings from all levels.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Merges permission rules from all 3 levels into unified TriLevelRule array
   */
  const mergeRulesFromAllLevels = (
    user: SettingsLevel, 
    team: SettingsLevel, 
    local: SettingsLevel
  ): TriLevelRule[] => {
    const ruleMap = new Map<string, TriLevelRule>();
    
    // Helper to add rules to map
    const addRules = (rules: string[], type: "allow" | "deny", level: "user" | "team" | "local") => {
      rules.forEach(rule => {
        const key = `${type}:${rule}`;
        if (ruleMap.has(key)) {
          // Rule already exists, update level
          ruleMap.get(key)!.levels[level] = true;
        } else {
          // New rule
          ruleMap.set(key, {
            id: `${type}-${rule}-${Date.now()}-${Math.random()}`,
            value: rule,
            type,
            levels: {
              user: level === "user",
              team: level === "team", 
              local: level === "local",
            }
          });
        }
      });
    };
    
    // Process all rules from all levels
    if (user.permissions?.allow) addRules(user.permissions.allow, "allow", "user");
    if (user.permissions?.deny) addRules(user.permissions.deny, "deny", "user");
    if (team.permissions?.allow) addRules(team.permissions.allow, "allow", "team");
    if (team.permissions?.deny) addRules(team.permissions.deny, "deny", "team");
    if (local.permissions?.allow) addRules(local.permissions.allow, "allow", "local");
    if (local.permissions?.deny) addRules(local.permissions.deny, "deny", "local");
    
    return Array.from(ruleMap.values());
  };

  /**
   * Adds a new rule (initially with no levels active)
   */
  const addRule = (type: "allow" | "deny", value: string) => {
    const newRule: TriLevelRule = {
      id: `${type}-${value}-${Date.now()}-${Math.random()}`,
      value,
      type,
      levels: { user: false, team: false, local: false }
    };
    setRules(prev => [...prev, newRule]);
  };

  /**
   * Toggles a rule's presence at a specific level
   */
  const toggleRuleLevel = async (ruleId: string, level: "user" | "team" | "local") => {
    setRules(prev => prev.map(rule => {
      if (rule.id === ruleId) {
        const newRule = { 
          ...rule, 
          levels: { 
            ...rule.levels, 
            [level]: !rule.levels[level] 
          } 
        };
        return newRule;
      }
      return rule;
    }).filter(rule => 
      // Auto-cleanup: remove rules that have no active levels
      rule.levels.user || rule.levels.team || rule.levels.local
    ));
  };

  /**
   * Updates a rule's value (applies to all levels where rule exists)
   */
  const updateRuleValue = (ruleId: string, value: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, value } : rule
    ));
  };

  /**
   * Deletes a rule entirely (removes from all levels)
   */
  const deleteRule = async (ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  /**
   * Saves all changes to their respective settings files
   */
  const saveAllLevels = async (projectPath: string) => {
    try {
      setSaving(true);
      setError(null);
      
      // Build settings for each level
      const newUserSettings = buildSettingsForLevel("user");
      const newTeamSettings = buildSettingsForLevel("team");
      const newLocalSettings = buildSettingsForLevel("local");
      
      // Save user settings
      await api.saveClaudeSettings({
        ...userSettings,
        permissions: newUserSettings.permissions
      });
      
      // Save team settings
      const teamSettingsPath = `${projectPath}/.claude/settings.json`;
      await api.saveClaudeMdFile(
        teamSettingsPath, 
        JSON.stringify({ ...teamSettings, permissions: newTeamSettings.permissions }, null, 2)
      );
      
      // Save local settings
      const localSettingsPath = `${projectPath}/.claude/settings.local.json`;
      await api.saveClaudeMdFile(
        localSettingsPath,
        JSON.stringify({ ...localSettings, permissions: newLocalSettings.permissions }, null, 2)
      );
      
      // Update stored settings
      setUserSettings(prev => ({ ...prev, permissions: newUserSettings.permissions }));
      setTeamSettings(prev => ({ ...prev, permissions: newTeamSettings.permissions }));
      setLocalSettings(prev => ({ ...prev, permissions: newLocalSettings.permissions }));
      
      onSaveComplete?.(true, "Settings saved to all levels successfully!");
      
    } catch (err) {
      console.error("Failed to save tri-level settings:", err);
      setError("Failed to save settings.");
      onSaveComplete?.(false, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Builds settings object for a specific level
   */
  const buildSettingsForLevel = (level: "user" | "team" | "local") => {
    const allowRules = rules
      .filter(rule => rule.type === "allow" && rule.levels[level] && rule.value.trim())
      .map(rule => rule.value);
      
    const denyRules = rules
      .filter(rule => rule.type === "deny" && rule.levels[level] && rule.value.trim())
      .map(rule => rule.value);
    
    return {
      permissions: {
        allow: allowRules,
        deny: denyRules
      }
    };
  };

  // Auto-cleanup happens when rules are toggled off at all levels
  // This is handled in the toggleRuleLevel function instead of useEffect

  return {
    // State
    loading,
    saving, 
    error,
    rules,
    
    // Actions
    loadSettings,
    addRule,
    toggleRuleLevel,
    updateRuleValue,
    deleteRule,
    saveAllLevels,
  };
};