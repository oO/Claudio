import React, { useState, useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api, type ClaudeSettings } from "@/lib/api";
import { logger } from '@/lib/logger';

export interface PermissionRule {
  id: string;
  value: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

export interface SettingsState {
  settings: ClaudeSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  allowRules: PermissionRule[];
  askRules: PermissionRule[];
  denyRules: PermissionRule[];
  envVars: EnvironmentVariable[];
  hasChanges: boolean;
}

export interface SettingsActions {
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => void;
  addPermissionRule: (type: "allow" | "ask" | "deny") => void;
  updatePermissionRule: (type: "allow" | "ask" | "deny", id: string, value: string) => void;
  removePermissionRule: (type: "allow" | "ask" | "deny", id: string) => void;
  addEnvVar: () => void;
  updateEnvVar: (id: string, field: "key" | "value", value: string) => void;
  removeEnvVar: (id: string) => void;
  setError: (error: string | null) => void;
}

export const useSettingsState = (
  onSaveComplete?: (success: boolean, message: string) => void,
  onHooksChanged?: (changed: boolean) => void,
  onProxyChanged?: (changed: boolean) => void,
  onBinaryPathChanged?: (changed: boolean) => void
): SettingsState & SettingsActions => {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [askRules, setAskRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);

  // Track original values to detect changes
  const [originalSettings, setOriginalSettings] = useState<ClaudeSettings | null>(null);
  const [originalAllowRules, setOriginalAllowRules] = useState<PermissionRule[]>([]);
  const [originalAskRules, setOriginalAskRules] = useState<PermissionRule[]>([]);
  const [originalDenyRules, setOriginalDenyRules] = useState<PermissionRule[]>([]);
  const [originalEnvVars, setOriginalEnvVars] = useState<EnvironmentVariable[]>([]);

  // Track changes for external hooks/components
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const [proxySettingsChanged, setProxySettingsChanged] = useState(false);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);

  // External save functions
  const getUserHooks = useRef<(() => any) | null>(null);
  const saveProxySettings = useRef<(() => Promise<void>) | null>(null);

  /**
   * Loads the current Claude settings
   */
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      
      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        logger.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);

      // Parse permissions
      let parsedAllowRules: PermissionRule[] = [];
      let parsedAskRules: PermissionRule[] = [];
      let parsedDenyRules: PermissionRule[] = [];
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          parsedAllowRules = loadedSettings.permissions.allow.map((rule: string, index: number) => ({
            id: `allow-${index}`,
            value: rule,
          }));
          setAllowRules(parsedAllowRules);
          setOriginalAllowRules(parsedAllowRules);
        }
        if (Array.isArray(loadedSettings.permissions.ask)) {
          parsedAskRules = loadedSettings.permissions.ask.map((rule: string, index: number) => ({
            id: `ask-${index}`,
            value: rule,
          }));
          setAskRules(parsedAskRules);
          setOriginalAskRules(parsedAskRules);
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          parsedDenyRules = loadedSettings.permissions.deny.map((rule: string, index: number) => ({
            id: `deny-${index}`,
            value: rule,
          }));
          setDenyRules(parsedDenyRules);
          setOriginalDenyRules(parsedDenyRules);
        }
      }

      // Parse environment variables
      let parsedEnvVars: EnvironmentVariable[] = [];
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        parsedEnvVars = Object.entries(loadedSettings.env).map(([key, value], index) => ({
          id: `env-${index}`,
          key,
          value: value as string,
        }));
        setEnvVars(parsedEnvVars);
        setOriginalEnvVars(parsedEnvVars);
      }
    } catch (err) {
      logger.error("Failed to load settings:", err);
      setError("Failed to load settings. Please ensure ~/.claude directory exists.");
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          ask: askRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v && String(v).trim()),
        },
        env: envVars.reduce((acc, { key, value }) => {
          if (key && String(key).trim() && value && String(value).trim()) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>),
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
      setOriginalAllowRules([...allowRules]);
      setOriginalAskRules([...askRules]);
      setOriginalDenyRules([...denyRules]);
      setOriginalEnvVars([...envVars]);

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig('user', hooks);
        setUserHooksChanged(false);
        onHooksChanged?.(false);
      }

      // Save proxy settings if changed
      if (proxySettingsChanged && saveProxySettings.current) {
        await saveProxySettings.current();
        setProxySettingsChanged(false);
        onProxyChanged?.(false);
      }

      // Handle binary path changes externally
      if (binaryPathChanged) {
        setBinaryPathChanged(false);
        onBinaryPathChanged?.(false);
      }

      onSaveComplete?.(true, "Settings saved successfully!");
    } catch (err) {
      logger.error("Failed to save settings:", err);
      setError("Failed to save settings.");
      onSaveComplete?.(false, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Adds a new permission rule
   */
  const addPermissionRule = (type: "allow" | "ask" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };

    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else if (type === "ask") {
      setAskRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "ask" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule =>
        rule.id === id ? { ...rule, value } : rule
      ));
    } else if (type === "ask") {
      setAskRules(prev => prev.map(rule =>
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setDenyRules(prev => prev.map(rule =>
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a permission rule
   */
  const removePermissionRule = (type: "allow" | "ask" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else if (type === "ask") {
      setAskRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };
    setEnvVars(prev => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (id: string, field: "key" | "value", value: string) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ));
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id));
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Expose refs for external components
  const registerHooksGetter = (getter: (() => any) | null) => {
    getUserHooks.current = getter;
  };

  const registerProxySaver = (saver: (() => Promise<void>) | null) => {
    saveProxySettings.current = saver;
  };

  const setHooksChanged = (changed: boolean) => {
    setUserHooksChanged(changed);
    onHooksChanged?.(changed);
  };

  const setProxyChanged = (changed: boolean) => {
    setProxySettingsChanged(changed);
    onProxyChanged?.(changed);
  };

  const setBinaryChanged = (changed: boolean) => {
    setBinaryPathChanged(changed);
    onBinaryPathChanged?.(changed);
  };

  // Calculate if there are any changes
  const hasChanges = React.useMemo(() => {
    // If still loading or no original settings, no changes
    if (loading || !originalSettings) return false;
    
    // Check settings changes
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    
    // Check permission rules changes
    const allowRulesChanged = JSON.stringify(allowRules) !== JSON.stringify(originalAllowRules);
    const askRulesChanged = JSON.stringify(askRules) !== JSON.stringify(originalAskRules);
    const denyRulesChanged = JSON.stringify(denyRules) !== JSON.stringify(originalDenyRules);

    // Check environment variables changes
    const envVarsChanged = JSON.stringify(envVars) !== JSON.stringify(originalEnvVars);

    // Also check external components
    return settingsChanged || allowRulesChanged || askRulesChanged || denyRulesChanged || envVarsChanged ||
           userHooksChanged || proxySettingsChanged || binaryPathChanged;
  }, [settings, originalSettings, allowRules, originalAllowRules, askRules, originalAskRules, denyRules, originalDenyRules,
      envVars, originalEnvVars, userHooksChanged, proxySettingsChanged, binaryPathChanged, loading]);

  return {
    // State
    settings,
    loading,
    saving,
    error,
    allowRules,
    askRules,
    denyRules,
    envVars,
    hasChanges,
    
    // Actions
    loadSettings,
    saveSettings,
    updateSetting,
    addPermissionRule,
    updatePermissionRule,
    removePermissionRule,
    addEnvVar,
    updateEnvVar,
    removeEnvVar,
    setError,
  };
};