/**
 * Types for Claude Code hooks configuration
 */

export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number; // Optional timeout in seconds (default: 60)
}

export interface HookMatcher {
  matcher?: string; // Pattern to match tool names (regex supported)
  hooks: HookCommand[];
}

export interface HooksConfiguration {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Notification?: HookCommand[];
  Stop?: HookCommand[];
  SubagentStop?: HookCommand[];
  UserPromptSubmit?: HookCommand[];
  PreCompact?: HookCommand[];
  SessionStart?: HookCommand[];
  SessionEnd?: HookCommand[];
}

export type HookEvent = keyof HooksConfiguration;

export interface ClaudeSettingsWithHooks {
  hooks?: HooksConfiguration;
  [key: string]: any;
}

export interface HookValidationError {
  event: string;
  matcher?: string;
  command?: string;
  message: string;
}

export interface HookValidationWarning {
  event: string;
  matcher?: string;
  command: string;
  message: string;
}

export interface HookValidationResult {
  valid: boolean;
  errors: HookValidationError[];
  warnings: HookValidationWarning[];
}

export type HookScope = 'user' | 'project' | 'local';

// Common tool matchers for autocomplete
export const COMMON_TOOL_MATCHERS = [
  'Task',
  'Bash',
  'Glob',
  'Grep',
  'Read',
  'Edit',
  'MultiEdit',
  'Write',
  'WebFetch',
  'WebSearch',
  'Notebook.*',
  'Edit|Write',
  'mcp__.*',
  'mcp__memory__.*',
  'mcp__filesystem__.*',
  'mcp__github__.*',
];

// Hook templates
export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  event: HookEvent;
  matcher?: string;
  commands: string[];
}

// Hook registry for metadata and configuration
export interface HookMetadata {
  label: string;
  description: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'gray';
  hasMatchers: boolean;
  icon: string;
}

export const HOOK_REGISTRY: Record<HookEvent, HookMetadata> = {
  PreToolUse: {
    label: 'Pre Tool Use',
    description: 'Runs before tool calls, can block and provide feedback',
    color: 'blue',
    hasMatchers: true,
    icon: 'Zap'
  },
  PostToolUse: {
    label: 'Post Tool Use',
    description: 'Runs after successful tool completion',
    color: 'green',
    hasMatchers: true,
    icon: 'CheckCircle'
  },
  UserPromptSubmit: {
    label: 'User Prompt Submit',
    description: 'Modify or validate prompts before submission',
    color: 'purple',
    hasMatchers: false,
    icon: 'Edit3'
  },
  Notification: {
    label: 'Notification',
    description: 'Customizes notifications when Claude needs attention',
    color: 'yellow',
    hasMatchers: false,
    icon: 'Bell'
  },
  Stop: {
    label: 'Stop',
    description: 'Runs when Claude finishes responding',
    color: 'orange',
    hasMatchers: false,
    icon: 'Square'
  },
  SubagentStop: {
    label: 'Subagent Stop',
    description: 'Runs when a Claude subagent (Task) finishes',
    color: 'red',
    hasMatchers: false,
    icon: 'Bot'
  },
  PreCompact: {
    label: 'Pre Compact',
    description: 'Runs before conversation history is compacted',
    color: 'gray',
    hasMatchers: false,
    icon: 'Archive'
  },
  SessionStart: {
    label: 'Session Start',
    description: 'Runs when a new session begins',
    color: 'blue',
    hasMatchers: false,
    icon: 'Play'
  },
  SessionEnd: {
    label: 'Session End',
    description: 'Runs when a session concludes',
    color: 'gray',
    hasMatchers: false,
    icon: 'StopCircle'
  }
};

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: 'log-bash-commands',
    name: 'Log Shell Commands',
    description: 'Log all bash commands to a file for auditing',
    event: 'PreToolUse',
    matcher: 'Bash',
    commands: ['jq -r \'"\(.tool_input.command) - \(.tool_input.description // "No description")"\' >> ~/.claude/bash-command-log.txt']
  },
  {
    id: 'format-on-save',
    name: 'Auto-format Code',
    description: 'Run code formatters after file modifications',
    event: 'PostToolUse',
    matcher: 'Write|Edit|MultiEdit',
    commands: [
      'if [[ "$( jq -r .tool_input.file_path )" =~ \\.(ts|tsx|js|jsx)$ ]]; then prettier --write "$( jq -r .tool_input.file_path )"; fi',
      'if [[ "$( jq -r .tool_input.file_path )" =~ \\.go$ ]]; then gofmt -w "$( jq -r .tool_input.file_path )"; fi'
    ]
  },
  {
    id: 'git-commit-guard',
    name: 'Protect Main Branch',
    description: 'Prevent direct commits to main/master branch',
    event: 'PreToolUse',
    matcher: 'Bash',
    commands: ['if [[ "$(jq -r .tool_input.command)" =~ "git commit" ]] && [[ "$(git branch --show-current 2>/dev/null)" =~ ^(main|master)$ ]]; then echo "Direct commits to main/master branch are not allowed"; exit 2; fi']
  },
  {
    id: 'custom-notification',
    name: 'Custom Notifications',
    description: 'Send custom notifications when Claude needs attention',
    event: 'Notification',
    commands: ['osascript -e "display notification \\"$(jq -r .message)\\" with title \\"$(jq -r .title)\\" sound name \\"Glass\\""']
  },
  {
    id: 'continue-on-tests',
    name: 'Auto-continue on Test Success',
    description: 'Automatically continue when tests pass',
    event: 'Stop',
    commands: ['if grep -q "All tests passed" "$( jq -r .transcript_path )"; then echo \'{"decision": "block", "reason": "All tests passed. Continue with next task."}\'; fi']
  },
  // New templates for missing hooks
  {
    id: 'prompt-context-injection',
    name: 'Add Context to Prompts',
    description: 'Automatically inject project context into user prompts',
    event: 'UserPromptSubmit',
    commands: ['echo "Adding project context: $(pwd | xargs basename) - $(git branch --show-current 2>/dev/null || echo "no git")"']
  },
  {
    id: 'archive-conversation',
    name: 'Archive Before Compact',
    description: 'Save conversation history before it gets compacted',
    event: 'PreCompact',
    commands: ['cp "$( jq -r .session_path )" ~/.claude/archives/session-$(date +%Y%m%d-%H%M%S).jsonl']
  },
  {
    id: 'session-start-log',
    name: 'Log Session Start',
    description: 'Log when new sessions begin with project info',
    event: 'SessionStart',
    commands: ['echo "$(date): New session started in $(pwd)" >> ~/.claude/session-log.txt']
  },
  {
    id: 'session-end-cleanup',
    name: 'Session Cleanup',
    description: 'Clean up temporary files when session ends',
    event: 'SessionEnd',
    commands: ['find /tmp -name "claude-*" -type f -mtime +1 -delete 2>/dev/null || true']
  }
]; 
