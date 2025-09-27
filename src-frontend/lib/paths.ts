/**
 * Path constants and utilities for Claudio Frontend
 *
 * This module provides centralized path management to eliminate hardcoded strings.
 * All file paths in the frontend should use these constants and functions.
 */

// ===== Path Constants =====
export const PATHS = {
  // Claudio App Paths
  CLAUDIO: {
    DIR_NAME: '.claudio',
    SETTINGS_FILE: 'settings.json',
    DB_FILE: 'claudio.db',
    LOGS_DIR: 'logs',
    TEMP_DIR: 'temp',
  },

  // Claude Code CLI Paths
  CLAUDE_CODE: {
    DIR_NAME: '.claude',
    SETTINGS_FILE: 'settings.json',
    SETTINGS_LOCAL_FILE: 'settings.local.json',
    CLAUDE_MD_FILE: 'CLAUDE.md',
    AGENTS_DIR: 'agents',
    SESSIONS_DIR: 'sessions',
    PROJECTS_DIR: 'projects',
    MEMORIES_DIR: 'memories',
    TIMELINES_DIR: 'timelines',
  },

  // Session patterns
  SESSION: {
    EXTENSION: '.jsonl',
    CLAUDIO_PREFIX: 'claudio-',
    CLAUDE_PREFIX: 'claude-',
  },

  // File extensions
  EXTENSIONS: {
    AGENT: '.md',
    MEMORY: '.md',
    SETTINGS: '.json',
    SESSION: '.jsonl',
  }
} as const;

// ===== Environment Variables =====
export const ENV_VARS = {
  // Claude Code environment variables
  ANTHROPIC_MODEL: 'ANTHROPIC_MODEL',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'ANTHROPIC_DEFAULT_OPUS_MODEL',

  // Claudio app environment variables
  CLAUDIO_DEBUG: 'CLAUDIO_DEBUG',
  CLAUDIO_LOG_LEVEL: 'CLAUDIO_LOG_LEVEL',
  CLAUDIO_NEW_SETTINGS: 'CLAUDIO_NEW_SETTINGS',
  RUST_LOG: 'RUST_LOG',
} as const;

// ===== Path Builder Functions =====

/**
 * Build Claudio app paths
 */
export const buildClaudioPaths = {
  // Home directory
  home: (): string => `~/${PATHS.CLAUDIO.DIR_NAME}`,

  // Settings file
  settings: (): string =>
    `~/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.SETTINGS_FILE}`,

  // Database file
  database: (): string =>
    `~/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.DB_FILE}`,

  // Logs directory
  logsDir: (): string =>
    `~/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.LOGS_DIR}`,

  // Temp directory
  tempDir: (): string =>
    `~/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.TEMP_DIR}`,
};

/**
 * Build Claude Code global paths
 */
export const buildClaudeCodeGlobalPaths = {
  // Home directory
  home: (): string => `~/${PATHS.CLAUDE_CODE.DIR_NAME}`,

  // Global settings file
  settings: (): string =>
    `~/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_FILE}`,

  // Global CLAUDE.md file
  claudeMd: (): string =>
    `~/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.CLAUDE_MD_FILE}`,

  // Projects directory
  projectsDir: (): string =>
    `~/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.PROJECTS_DIR}`,

  // Global agents directory
  agentsDir: (): string =>
    `~/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.AGENTS_DIR}`,

  // Global sessions directory
  sessionsDir: (): string =>
    `~/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SESSIONS_DIR}`,
};

/**
 * Build Claude Code project-specific paths
 */
export const buildClaudeCodeProjectPaths = {
  // Project's .claude directory
  claudeDir: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}`,

  // Project settings file
  settings: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_FILE}`,

  // Project local settings file
  settingsLocal: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_LOCAL_FILE}`,

  // Project CLAUDE.md file
  claudeMd: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.CLAUDE_MD_FILE}`,

  // Project agents directory
  agentsDir: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.AGENTS_DIR}`,

  // Project sessions directory
  sessionsDir: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SESSIONS_DIR}`,

  // Project memories directory
  memoriesDir: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.MEMORIES_DIR}`,

  // Project timelines directory
  timelinesDir: (projectPath: string): string =>
    `${projectPath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.TIMELINES_DIR}`,
};

// ===== Type-Safe Path Validation =====

/**
 * Check if filename is a session file
 */
export const isSessionFile = (filename: string): boolean =>
  filename.endsWith(PATHS.SESSION.EXTENSION);

/**
 * Check if filename is a Claudio session
 */
export const isClaudioSession = (filename: string): boolean =>
  filename.startsWith(PATHS.SESSION.CLAUDIO_PREFIX) &&
  filename.endsWith(PATHS.SESSION.EXTENSION);

/**
 * Check if filename is a Claude session
 */
export const isClaudeSession = (filename: string): boolean =>
  filename.startsWith(PATHS.SESSION.CLAUDE_PREFIX) &&
  filename.endsWith(PATHS.SESSION.EXTENSION);

/**
 * Check if filename is an agent file
 */
export const isAgentFile = (filename: string): boolean =>
  filename.endsWith(PATHS.EXTENSIONS.AGENT);

/**
 * Check if filename is a memory file
 */
export const isMemoryFile = (filename: string): boolean =>
  filename.endsWith(PATHS.EXTENSIONS.MEMORY);

/**
 * Check if filename is a settings file
 */
export const isSettingsFile = (filename: string): boolean =>
  filename.endsWith(PATHS.EXTENSIONS.SETTINGS);

// ===== Path Utilities =====

/**
 * Extract project name from project path
 */
export const getProjectName = (projectPath: string): string => {
  return projectPath.split('/').pop() || 'Unknown Project';
};

/**
 * Get relative path within project
 */
export const getRelativePath = (projectPath: string, filePath: string): string => {
  if (filePath.startsWith(projectPath)) {
    return filePath.slice(projectPath.length + 1); // +1 for the /
  }
  return filePath;
};

/**
 * Check if path is within project's .claude directory
 */
export const isInClaudeDir = (projectPath: string, filePath: string): boolean => {
  const claudeDir = buildClaudeCodeProjectPaths.claudeDir(projectPath);
  return filePath.startsWith(claudeDir);
};

/**
 * Build session file name
 */
export const buildSessionFileName = (
  type: 'claudio' | 'claude',
  sessionId: string
): string => {
  const prefix = type === 'claudio'
    ? PATHS.SESSION.CLAUDIO_PREFIX
    : PATHS.SESSION.CLAUDE_PREFIX;
  return `${prefix}${sessionId}${PATHS.SESSION.EXTENSION}`;
};

/**
 * Parse session file name to extract type and ID
 */
export const parseSessionFileName = (filename: string): {
  type: 'claudio' | 'claude' | 'unknown',
  sessionId: string | null
} => {
  if (isClaudioSession(filename)) {
    const sessionId = filename
      .slice(PATHS.SESSION.CLAUDIO_PREFIX.length)
      .replace(PATHS.SESSION.EXTENSION, '');
    return { type: 'claudio', sessionId };
  }

  if (isClaudeSession(filename)) {
    const sessionId = filename
      .slice(PATHS.SESSION.CLAUDE_PREFIX.length)
      .replace(PATHS.SESSION.EXTENSION, '');
    return { type: 'claude', sessionId };
  }

  return { type: 'unknown', sessionId: null };
};

// ===== Environment Utilities =====

/**
 * Get model from client-side environment (if available)
 * Note: Most env vars are server-side only in Tauri
 */
export const getClientEnvModel = (): string | null => {
  // In development, might be available via import.meta.env
  if (typeof window !== 'undefined' && 'process' in window) {
    // Node.js environment (development)
    return (window as any).process?.env?.ANTHROPIC_MODEL || null;
  }
  return null;
};

// ===== Testing Utilities =====

/**
 * Mock paths for testing
 */
export const createTestPaths = (basePath: string) => ({
  claudio: {
    home: `${basePath}/${PATHS.CLAUDIO.DIR_NAME}`,
    settings: `${basePath}/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.SETTINGS_FILE}`,
    database: `${basePath}/${PATHS.CLAUDIO.DIR_NAME}/${PATHS.CLAUDIO.DB_FILE}`,
  },
  claudeCode: {
    home: `${basePath}/${PATHS.CLAUDE_CODE.DIR_NAME}`,
    settings: `${basePath}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_FILE}`,
  },
  project: (projectName: string) => ({
    base: `${basePath}/${projectName}`,
    claude: `${basePath}/${projectName}/${PATHS.CLAUDE_CODE.DIR_NAME}`,
    settings: `${basePath}/${projectName}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_FILE}`,
    settingsLocal: `${basePath}/${projectName}/${PATHS.CLAUDE_CODE.DIR_NAME}/${PATHS.CLAUDE_CODE.SETTINGS_LOCAL_FILE}`,
  })
});

// ===== Type Definitions =====

/**
 * Supported settings levels
 */
export type SettingsLevel = 'env' | 'local' | 'project' | 'global';

/**
 * Settings type discrimination
 */
export type SettingsType = 'claudio' | 'claudecode';

/**
 * File type discrimination
 */
export type FileType = 'session' | 'agent' | 'memory' | 'settings' | 'unknown';

/**
 * Session type discrimination
 */
export type SessionType = 'claudio' | 'claude' | 'unknown';

// ===== Validation Functions =====

/**
 * Validate that a path string looks reasonable
 */
export const isValidPath = (path: string): boolean => {
  if (!path || typeof path !== 'string') return false;

  // Check for dangerous patterns
  const dangerousPatterns = [
    '../',
    '..\\',
    '//',
    '\\\\',
    '\x00', // null byte
  ];

  return !dangerousPatterns.some(pattern => path.includes(pattern));
};

/**
 * Sanitize path string for safe usage
 */
export const sanitizePath = (path: string): string => {
  if (!path || typeof path !== 'string') return '';

  // Remove dangerous characters and patterns
  return path
    .replace(/\.\./g, '') // Remove .. patterns
    .replace(/\/+/g, '/') // Collapse multiple slashes
    .replace(/\\+/g, '\\') // Collapse multiple backslashes
    .replace(/\x00/g, '') // Remove null bytes
    .trim();
};

// ===== Default Export =====
export default {
  PATHS,
  ENV_VARS,
  buildClaudioPaths,
  buildClaudeCodeGlobalPaths,
  buildClaudeCodeProjectPaths,
  isSessionFile,
  isClaudioSession,
  isClaudeSession,
  isAgentFile,
  isMemoryFile,
  isSettingsFile,
  getProjectName,
  getRelativePath,
  isInClaudeDir,
  buildSessionFileName,
  parseSessionFileName,
  getClientEnvModel,
  createTestPaths,
  isValidPath,
  sanitizePath,
};