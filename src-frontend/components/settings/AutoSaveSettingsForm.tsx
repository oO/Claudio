import React from 'react';
import { cn } from '@/lib/utils';
import AutoSaveInput from '@/components/common/AutoSaveInput';
import { useSettingsHandle } from '@/hooks/useSettingsHandle';
import { logger } from '@/lib/logger';

export interface SettingsFieldConfig {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'boolean' | 'select' | 'textarea' | 'number';
  options?: Array<{label: string, value: any}>;
  placeholder?: string;
  defaultValue?: any;
  level?: 'env' | 'local' | 'project' | 'global'; // For ClaudeCode settings only
  disabled?: boolean;
  section?: string; // For grouping fields
}

export interface AutoSaveSettingsFormProps {
  /** Type of settings - Claude Code only (Claudio settings use direct API) */
  settingsType: 'claudecode';

  /** Project path - required for claudecode settings */
  projectPath?: string;

  /** Field configurations */
  fields: SettingsFieldConfig[];

  /** Form title */
  title?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for the form */
  'data-testid'?: string;
}

/**
 * Auto-save settings form component
 *
 * Eliminates save buttons by providing instant persistence with optimistic updates.
 * Follows the spec requirements for modern auto-save UX.
 */
export function AutoSaveSettingsForm({
  settingsType,
  projectPath,
  fields,
  title,
  className,
  'data-testid': testId,
}: AutoSaveSettingsFormProps) {
  const { settings, loading, error, updateSetting } = useSettingsHandle(
    projectPath
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-400 font-medium">Failed to load settings</p>
        <p className="text-red-600 dark:text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Group fields by section
  const groupedFields = fields.reduce((acc, field) => {
    const section = field.section || 'General';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, SettingsFieldConfig[]>);

  const handleFieldChange = async (field: SettingsFieldConfig, value: any) => {
    try {
      await updateSetting(field.key, value, field.level);
    } catch (error) {
      logger.error(`Failed to update setting ${field.key}:`, error);
      throw error; // Let AutoSaveInput handle the error state
    }
  };

  const getCurrentValue = (field: SettingsFieldConfig) => {
    if (!settings) return field.defaultValue;

    // For ClaudeCode settings, use effective settings
    if (settingsType === 'claudecode' && settings.effective) {
      return settings.effective[field.key] ?? field.defaultValue;
    }

    // For Claudio settings, use direct property access
    return settings[field.key] ?? field.defaultValue;
  };

  return (
    <div className={cn("space-y-6", className)} data-testid={testId}>
      {title && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </div>
      )}

      {Object.entries(groupedFields).map(([sectionName, sectionFields]) => (
        <div key={sectionName} className="space-y-4">
          {Object.keys(groupedFields).length > 1 && (
            <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-2">
              {sectionName}
            </h3>
          )}

          <div className="space-y-4">
            {sectionFields.map((field) => (
              <SettingsField
                key={field.key}
                field={field}
                value={getCurrentValue(field)}
                onChange={(value) => handleFieldChange(field, value)}
                settingsType={settingsType}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Show settings precedence info for ClaudeCode settings */}
      {settingsType === 'claudecode' && settings && (
        <SettingsPrecedenceInfo
          settings={settings}
          projectPath={projectPath}
        />
      )}
    </div>
  );
}

/**
 * Individual settings field component
 */
interface SettingsFieldProps {
  field: SettingsFieldConfig;
  value: any;
  onChange: (value: any) => Promise<void>;
  settingsType: 'claudecode';
}

function SettingsField({ field, value, onChange, settingsType }: SettingsFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={field.key}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {field.label}
          {field.level && settingsType === 'claudecode' && (
            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
              {field.level}
            </span>
          )}
        </label>
      </div>

      {field.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {field.description}
        </p>
      )}

      <div className="relative">
        <AutoSaveInput
          value={value}
          onChange={onChange}
          type={field.type}
          options={field.options}
          placeholder={field.placeholder}
          disabled={field.disabled}
          data-testid={`setting-${field.key}`}
          className="pr-10" // Space for save indicator
        />
      </div>
    </div>
  );
}

/**
 * Display settings precedence information for ClaudeCode settings
 */
interface SettingsPrecedenceInfoProps {
  settings: any;
  projectPath?: string;
}

function SettingsPrecedenceInfo({ settings, projectPath }: SettingsPrecedenceInfoProps) {
  if (!settings.layers) return null;

  const layers = [
    { name: 'Environment', data: settings.layers.env, priority: 'Highest' },
    { name: 'Local', data: settings.layers.local, priority: 'High' },
    { name: 'Project', data: settings.layers.project, priority: 'Medium' },
    { name: 'Global', data: settings.layers.global, priority: 'Lowest' },
  ];

  const activeLayers = layers.filter(layer => layer.data);

  return (
    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Settings Precedence {projectPath && `(${projectPath})`}
      </h4>

      <div className="space-y-2">
        {activeLayers.map((layer, index) => (
          <div
            key={layer.name}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-gray-600 dark:text-gray-400">
              {index + 1}. {layer.name}
            </span>
            <span className="text-gray-500 dark:text-gray-500">
              {layer.priority} Priority
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Settings are applied in order of precedence. Higher priority settings override lower ones.
      </p>
    </div>
  );
}

export default AutoSaveSettingsForm;