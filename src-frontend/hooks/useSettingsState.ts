import { useState, useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { api, type ClaudeSettings } from "@/lib/api";

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
  denyRules: PermissionRule[];
  envVars: EnvironmentVariable[];
}

export interface SettingsActions {
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => void;
  addPermissionRule: (type: "allow" | "deny") => void;
  updatePermissionRule: (type: "allow" | "deny", id: string, value: string) => void;
  removePermissionRule: (type: "allow" | "deny", id: string) => void;
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
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);

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
        console.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
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
      console.error("Failed to save settings:", err);
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
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };
    
    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule => 
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
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
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

  return {
    // State
    settings,
    loading,
    saving,
    error,
    allowRules,
    denyRules,
    envVars,
    
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