/**
 * React contexts for the new settings system
 *
 * These contexts provide settings state throughout the React component tree
 * with automatic project awareness and handle management
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import type {
  ClaudioSettings,
  ClaudeCodeSettings,
  SettingsError,
  ProjectContext,
} from './types';
import {
  useProjectContext,
} from './hooks';
import {
  useCachedClaudeCodeSettings,
  useCachedClaudeCodeModelSetting,
} from './useCachedClaudeCodeSettings';

// ===== Project Context =====

interface ProjectContextState {
  currentProject: string | null;
  setCurrentProject: (projectPath: string | null) => void;
  projectContext: ProjectContext | null;
  loading: boolean;
  error: SettingsError | null;
}

const ProjectSettingsContext = createContext<ProjectContextState | undefined>(undefined);

interface ProjectSettingsProviderProps {
  children: ReactNode;
  initialProject?: string | null;
}

export function ProjectSettingsProvider({
  children,
  initialProject = null
}: ProjectSettingsProviderProps) {
  const [currentProject, setCurrentProject] = useState<string | null>(initialProject);

  const {
    context: projectContext,
    loading,
    error,
    refresh
  } = useProjectContext(currentProject);

  // Refresh context when project changes
  useEffect(() => {
    refresh();
  }, [currentProject, refresh]);

  const contextValue = useMemo(() => ({
    currentProject,
    setCurrentProject,
    projectContext,
    loading,
    error,
  }), [currentProject, projectContext, loading, error]);

  return (
    <ProjectSettingsContext.Provider value={contextValue}>
      {children}
    </ProjectSettingsContext.Provider>
  );
}

export function useProjectSettingsContext() {
  const context = useContext(ProjectSettingsContext);
  if (context === undefined) {
    throw new Error('useProjectSettingsContext must be used within a ProjectSettingsProvider');
  }
  return context;
}

// ===== Claudio Settings Context =====

interface ClaudioSettingsContextState {
  settings: ClaudioSettings | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  loading: boolean;
  error: SettingsError | null;
  theme: string;
  setTheme: (theme: string) => Promise<void>;
}

const ClaudioSettingsContext = createContext<ClaudioSettingsContextState | undefined>(undefined);

interface ClaudioSettingsProviderProps {
  children: ReactNode;
  projectPath?: string;
}

export function ClaudioSettingsProvider({
  children,
  projectPath
}: ClaudioSettingsProviderProps) {
  const {
    settings,
    updateSetting,
    loading,
    error
  } = { settings: null, updateSetting: async () => {}, loading: false, error: null }; // Claudio settings use direct API now

  // Theme settings use direct Claudio API now
  const theme = 'system';
  const setTheme = async () => {};

  const contextValue = useMemo(() => ({
    settings,
    updateSetting,
    loading,
    error,
    theme,
    setTheme,
  }), [settings, updateSetting, loading, error, theme, setTheme]);

  return (
    <ClaudioSettingsContext.Provider value={contextValue}>
      {children}
    </ClaudioSettingsContext.Provider>
  );
}

export function useClaudioSettingsContext() {
  const context = useContext(ClaudioSettingsContext);
  if (context === undefined) {
    throw new Error('useClaudioSettingsContext must be used within a ClaudioSettingsProvider');
  }
  return context;
}

// ===== ClaudeCode Settings Context =====

interface ClaudeCodeSettingsContextState {
  settings: ClaudeCodeSettings | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  loading: boolean;
  error: SettingsError | null;
  model: string;
  setModel: (model: string) => Promise<void>;
  allSettings: ClaudeCodeSettings | null;
}

const ClaudeCodeSettingsContext = createContext<ClaudeCodeSettingsContextState | undefined>(undefined);

interface ClaudeCodeSettingsProviderProps {
  children: ReactNode;
  projectPath?: string;
}

export function ClaudeCodeSettingsProvider({
  children,
  projectPath
}: ClaudeCodeSettingsProviderProps) {
  const {
    settings,
    updateSetting,
    loading,
    error
  } = useCachedClaudeCodeSettings(projectPath);

  const {
    model,
    updateModel: setModel
  } = useCachedClaudeCodeModelSetting(projectPath);

  const contextValue = useMemo(() => ({
    settings,
    updateSetting,
    loading,
    error,
    model,
    setModel,
    allSettings: settings,
  }), [settings, updateSetting, loading, error, model, setModel]);

  return (
    <ClaudeCodeSettingsContext.Provider value={contextValue}>
      {children}
    </ClaudeCodeSettingsContext.Provider>
  );
}

export function useClaudeCodeSettingsContext() {
  const context = useContext(ClaudeCodeSettingsContext);
  if (context === undefined) {
    throw new Error('useClaudeCodeSettingsContext must be used within a ClaudeCodeSettingsProvider');
  }
  return context;
}

// ===== Unified Settings Context =====

interface UnifiedSettingsContextState {
  // Project state
  currentProject: string | null;
  setCurrentProject: (projectPath: string | null) => void;

  // Claudio settings
  claudioSettings: ClaudioSettings | null;
  updateClaudioSetting: (key: string, value: any) => Promise<void>;
  theme: string;
  setTheme: (theme: string) => Promise<void>;

  // ClaudeCode settings
  claudecodeSettings: ClaudeCodeSettings | null;
  updateClaudecodeSetting: (key: string, value: any) => Promise<void>;
  model: string;
  setModel: (model: string) => Promise<void>;

  // Loading states
  claudioLoading: boolean;
  claudecodeLoading: boolean;
  loading: boolean;

  // Errors
  claudioError: SettingsError | null;
  claudecodeError: SettingsError | null;
  error: SettingsError | null;
}

const UnifiedSettingsContext = createContext<UnifiedSettingsContextState | undefined>(undefined);

interface UnifiedSettingsProviderProps {
  children: ReactNode;
  initialProject?: string | null;
}

export function UnifiedSettingsProvider({
  children,
  initialProject = null
}: UnifiedSettingsProviderProps) {
  return (
    <ProjectSettingsProvider initialProject={initialProject}>
      <UnifiedSettingsProviderInner>
        {children}
      </UnifiedSettingsProviderInner>
    </ProjectSettingsProvider>
  );
}

function UnifiedSettingsProviderInner({ children }: { children: ReactNode }) {
  const { currentProject, setCurrentProject } = useProjectSettingsContext();

  return (
    <ClaudioSettingsProvider projectPath={currentProject || undefined}>
      <ClaudeCodeSettingsProvider projectPath={currentProject || undefined}>
        <UnifiedSettingsProviderCore>
          {children}
        </UnifiedSettingsProviderCore>
      </ClaudeCodeSettingsProvider>
    </ClaudioSettingsProvider>
  );
}

function UnifiedSettingsProviderCore({ children }: { children: ReactNode }) {
  const { currentProject, setCurrentProject } = useProjectSettingsContext();

  const {
    settings: claudioSettings,
    updateSetting: updateClaudioSetting,
    loading: claudioLoading,
    error: claudioError,
    theme,
    setTheme,
  } = useClaudioSettingsContext();

  const {
    settings: claudecodeSettings,
    updateSetting: updateClaudecodeSetting,
    loading: claudecodeLoading,
    error: claudecodeError,
    model,
    setModel,
  } = useClaudeCodeSettingsContext();

  const contextValue = useMemo(() => ({
    // Project state
    currentProject,
    setCurrentProject,

    // Claudio settings
    claudioSettings,
    updateClaudioSetting,
    theme,
    setTheme,

    // ClaudeCode settings
    claudecodeSettings,
    updateClaudecodeSetting,
    model,
    setModel,

    // Loading states
    claudioLoading,
    claudecodeLoading,
    loading: claudioLoading || claudecodeLoading,

    // Errors
    claudioError,
    claudecodeError,
    error: claudioError || claudecodeError,
  }), [
    currentProject,
    setCurrentProject,
    claudioSettings,
    updateClaudioSetting,
    theme,
    setTheme,
    claudecodeSettings,
    updateClaudecodeSetting,
    model,
    setModel,
    claudioLoading,
    claudecodeLoading,
    claudioError,
    claudecodeError,
  ]);

  return (
    <UnifiedSettingsContext.Provider value={contextValue}>
      {children}
    </UnifiedSettingsContext.Provider>
  );
}

export function useUnifiedSettingsContext() {
  const context = useContext(UnifiedSettingsContext);
  if (context === undefined) {
    throw new Error('useUnifiedSettingsContext must be used within a UnifiedSettingsProvider');
  }
  return context;
}

// ===== Settings Router Context =====

interface SettingsRouterContextState {
  // Multi-project management
  activeProjects: Set<string>;
  addProject: (projectPath: string) => void;
  removeProject: (projectPath: string) => void;
  switchToProject: (projectPath: string) => void;

  // Settings for specific projects
  getProjectSettings: <T = any>(projectPath: string, settingsType: 'claudio' | 'claudecode') => T | null;
  updateProjectSetting: (projectPath: string, settingsType: 'claudio' | 'claudecode', key: string, value: any) => Promise<void>;
}

const SettingsRouterContext = createContext<SettingsRouterContextState | undefined>(undefined);

interface SettingsRouterProviderProps {
  children: ReactNode;
}

export function SettingsRouterProvider({ children }: SettingsRouterProviderProps) {
  const [activeProjects, setActiveProjects] = useState<Set<string>>(new Set());
  const { setCurrentProject } = useProjectSettingsContext();

  const addProject = useMemo(() => (projectPath: string) => {
    setActiveProjects(prev => new Set([...prev, projectPath]));
  }, []);

  const removeProject = useMemo(() => (projectPath: string) => {
    setActiveProjects(prev => {
      const next = new Set(prev);
      next.delete(projectPath);
      return next;
    });
  }, []);

  const switchToProject = useMemo(() => (projectPath: string) => {
    setCurrentProject(projectPath);
  }, [setCurrentProject]);

  // For MVP, these will be simplified
  const getProjectSettings = useMemo(() => <T = any>(
    projectPath: string,
    settingsType: 'claudio' | 'claudecode'
  ): T | null => {
    // TODO: Implement proper project-specific settings lookup
    console.log(`Getting ${settingsType} settings for ${projectPath}`);
    return null;
  }, []);

  const updateProjectSetting = useMemo(() => async (
    projectPath: string,
    settingsType: 'claudio' | 'claudecode',
    key: string,
    value: any
  ) => {
    // TODO: Implement proper project-specific settings update
    console.log(`Updating ${settingsType}.${key} = ${value} for ${projectPath}`);
  }, []);

  const contextValue = useMemo(() => ({
    activeProjects,
    addProject,
    removeProject,
    switchToProject,
    getProjectSettings,
    updateProjectSetting,
  }), [
    activeProjects,
    addProject,
    removeProject,
    switchToProject,
    getProjectSettings,
    updateProjectSetting,
  ]);

  return (
    <SettingsRouterContext.Provider value={contextValue}>
      {children}
    </SettingsRouterContext.Provider>
  );
}

export function useSettingsRouterContext() {
  const context = useContext(SettingsRouterContext);
  if (context === undefined) {
    throw new Error('useSettingsRouterContext must be used within a SettingsRouterProvider');
  }
  return context;
}

// ===== Convenience Hooks =====

/**
 * Get current model setting from context
 */
export function useCurrentModel(): string {
  const { model } = useClaudeCodeSettingsContext();
  return model;
}

/**
 * Get current theme setting from context
 */
export function useCurrentTheme(): string {
  const { theme } = useClaudioSettingsContext();
  return theme;
}

/**
 * Direct access to cached model setting (bypasses context)
 */
export function useDirectCachedModel(projectPath?: string): string {
  const { model } = useCachedClaudeCodeModelSetting(projectPath);
  return model;
}

/**
 * Direct access to cached theme setting (bypasses context)
 */
export function useDirectCachedTheme(projectPath?: string): string {
  const theme = 'system'; // Theme settings use direct Claudio API now
  return theme;
}

/**
 * Get current project path from context
 */
export function useCurrentProject(): string | null {
  const { currentProject } = useProjectSettingsContext();
  return currentProject;
}

/**
 * Check if settings are loading
 */
export function useSettingsLoading(): boolean {
  try {
    const { loading } = useUnifiedSettingsContext();
    return loading;
  } catch {
    // If unified context not available, check individual contexts
    try {
      const claudioContext = useClaudioSettingsContext();
      const claudecodeContext = useClaudeCodeSettingsContext();
      return claudioContext.loading || claudecodeContext.loading;
    } catch {
      return false;
    }
  }
}

/**
 * Get any settings errors
 */
export function useSettingsError(): SettingsError | null {
  try {
    const { error } = useUnifiedSettingsContext();
    return error;
  } catch {
    // If unified context not available, check individual contexts
    try {
      const claudioContext = useClaudioSettingsContext();
      const claudecodeContext = useClaudeCodeSettingsContext();
      return claudioContext.error || claudecodeContext.error;
    } catch {
      return null;
    }
  }
}