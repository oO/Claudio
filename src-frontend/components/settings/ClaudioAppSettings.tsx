import React from 'react';
import { useClaudioAppSettings, type ClaudioAppSettings } from '@/lib/claudio-app-settings';
import AutoSaveInput from '@/components/common/AutoSaveInput';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface FieldConfig {
  key: keyof ClaudioAppSettings;
  label: string;
  description?: string;
  type: 'text' | 'boolean' | 'select';
  options?: Array<{label: string, value: any}>;
  placeholder?: string;
  section?: string;
}

/**
 * Claudio app-level settings component
 *
 * Uses direct claudio_app_settings API - NO ORCHESTRATOR!
 * Optimistic updates for instant UI response.
 */
export function ClaudioAppSettings() {
  const { settings, updateSetting, loading, error } = useClaudioAppSettings();

  const fields: FieldConfig[] = [
    {
      key: 'theme',
      label: 'Theme',
      description: 'Choose your preferred color scheme',
      type: 'select',
      options: [
        { label: 'System', value: 'system' },
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
      section: 'Appearance',
    },
    {
      key: 'telemetry',
      label: 'Enable Telemetry',
      description: 'Help improve Claudio by sharing anonymous usage data',
      type: 'boolean',
      section: 'Privacy',
    },
    {
      key: 'auto_update',
      label: 'Auto Update',
      description: 'Automatically download and install updates',
      type: 'boolean',
      section: 'Updates',
    },
    {
      key: 'claude_binary_path',
      label: 'Claude Binary Path',
      description: 'Path to Claude Code binary (leave empty for auto-detection)',
      type: 'text',
      placeholder: '/usr/local/bin/claude',
      section: 'Developer',
    },
    {
      key: 'debug_mode',
      label: 'Debug Mode',
      description: 'Enable detailed logging for troubleshooting',
      type: 'boolean',
      section: 'Developer',
    },
  ];

  const handleFieldChange = async (field: FieldConfig, value: any) => {
    try {
      await updateSetting(field.key, value);
      logger.debug('ClaudioAppSettings: successfully updated setting', {
        key: field.key,
        value,
      });
    } catch (error) {
      logger.error('ClaudioAppSettings: failed to update setting', {
        key: field.key,
        value,
        error,
      });
      throw error;
    }
  };

  const getCurrentValue = (field: FieldConfig) => {
    if (!settings) return getDefaultValue(field);
    return settings[field.key] ?? getDefaultValue(field);
  };

  const getDefaultValue = (field: FieldConfig) => {
    switch (field.key) {
      case 'theme': return 'system';
      case 'telemetry': return true;
      case 'auto_update': return true;
      case 'debug_mode': return false;
      default: return undefined;
    }
  };

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
  }, {} as Record<string, FieldConfig[]>);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Claudio Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure your Claudio application preferences. Changes are saved automatically.
        </p>
      </div>

      <div className="space-y-6" data-testid="claudio-app-settings">
        {Object.entries(groupedFields).map(([sectionName, sectionFields]) => (
          <div key={sectionName} className="space-y-4">
            {Object.keys(groupedFields).length > 1 && (
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-2">
                {sectionName}
              </h3>
            )}

            <div className="space-y-4">
              {sectionFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={field.key}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {field.label}
                    </label>
                  </div>

                  {field.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {field.description}
                    </p>
                  )}

                  <div className="relative">
                    <AutoSaveInput
                      value={getCurrentValue(field)}
                      onChange={(value) => handleFieldChange(field, value)}
                      type={field.type}
                      options={field.options}
                      placeholder={field.placeholder}
                      data-testid={`setting-${field.key}`}
                      className="pr-10" // Space for save indicator
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          ✨ Direct API - No Orchestrator!
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          Your settings are saved directly to ~/.claudio/settings.json with optimistic updates for instant UI response.
        </p>
      </div>
    </div>
  );
}

export default ClaudioAppSettings;