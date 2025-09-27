import React from 'react';
import AutoSaveSettingsForm, { SettingsFieldConfig } from './AutoSaveSettingsForm';

export interface ClaudeCodeSettingsProps {
  projectPath?: string;
  showTitle?: boolean;
}

/**
 * Claude Code CLI settings component with multi-level precedence
 *
 * Demonstrates:
 * - Auto-save without save buttons
 * - Multi-level settings precedence (env > local > project > global)
 * - Real-time effective settings computation
 * - Optimistic updates with rollback on error
 */
export function ClaudeCodeSettings({
  projectPath,
  showTitle = true,
}: ClaudeCodeSettingsProps) {
  const fields: SettingsFieldConfig[] = [
    {
      key: 'model',
      label: 'Claude Model',
      description: 'Choose which Claude model to use for this project',
      type: 'select',
      options: [
        { label: 'Auto (Recommended)', value: 'auto' },
        { label: 'Claude 4 Opus', value: 'opus' },
        { label: 'Claude 4 Sonnet', value: 'sonnet' },
        { label: 'Default', value: 'default' },
        { label: 'Opus Plan', value: 'opusplan' },
      ],
      defaultValue: 'auto',
      level: projectPath ? 'project' : 'global',
      section: 'Model',
    },
    {
      key: 'system_prompt',
      label: 'System Prompt',
      description: 'Custom system prompt for Claude in this project',
      type: 'textarea',
      placeholder: 'You are a helpful assistant...',
      level: projectPath ? 'project' : 'global',
      section: 'Prompts',
    },
    {
      key: 'max_turns',
      label: 'Max Turns',
      description: 'Maximum number of conversation turns before auto-compact',
      type: 'number',
      placeholder: '50',
      level: projectPath ? 'project' : 'global',
      section: 'Limits',
    },
    {
      key: 'auto_save',
      label: 'Auto Save Settings',
      description: 'Automatically save settings changes',
      type: 'boolean',
      defaultValue: true,
      level: projectPath ? 'project' : 'global',
      section: 'Behavior',
    },
  ];

  // Add local-specific fields if this is a project
  if (projectPath) {
    fields.push(
      {
        key: 'model',
        label: 'Local Model Override',
        description: 'Override model for your local development (not shared with team)',
        type: 'select',
        options: [
          { label: 'Use Project Setting', value: '' },
          { label: 'Claude 4 Opus', value: 'opus' },
          { label: 'Claude 4 Sonnet', value: 'sonnet' },
          { label: 'Auto', value: 'auto' },
        ],
        level: 'local',
        section: 'Local Overrides',
      }
    );
  }

  const title = projectPath
    ? `Claude Code Settings - ${projectPath.split('/').pop()}`
    : 'Claude Code Global Settings';

  return (
    <div className="max-w-4xl mx-auto p-6">
      {showTitle && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <div className="mt-2 space-y-1">
            <p className="text-gray-600 dark:text-gray-400">
              Configure Claude Code CLI settings. Changes are saved automatically.
            </p>
            {projectPath && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Project: <span className="font-mono">{projectPath}</span>
              </p>
            )}
          </div>
        </div>
      )}

      <AutoSaveSettingsForm
        settingsType="claudecode"
        projectPath={projectPath}
        fields={fields}
        data-testid="claude-code-settings"
      />

      <SettingsPrecedenceGuide projectPath={projectPath} />
    </div>
  );
}

/**
 * Guide explaining settings precedence
 */
function SettingsPrecedenceGuide({ projectPath }: { projectPath?: string }) {
  return (
    <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
        📋 Settings Precedence
      </h3>
      <div className="text-amber-700 dark:text-amber-300 text-sm space-y-2">
        <p>Settings are applied in order of precedence (highest to lowest):</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li><strong>Environment Variables</strong> - Set via ANTHROPIC_MODEL, etc.</li>
          {projectPath && (
            <>
              <li><strong>Local Settings</strong> - <code>.claude/settings.local.json</code> (git-ignored)</li>
              <li><strong>Project Settings</strong> - <code>.claude/settings.json</code> (shared with team)</li>
            </>
          )}
          <li><strong>Global Settings</strong> - <code>~/.claude/settings.json</code> (user defaults)</li>
        </ol>
        <p className="mt-2 text-xs">
          💡 Use local settings for personal preferences, project settings for team configurations.
        </p>
      </div>
    </div>
  );
}

export default ClaudeCodeSettings;