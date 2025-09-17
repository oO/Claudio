import React from 'react';
import AutoSaveSettingsForm, { SettingsFieldConfig } from './AutoSaveSettingsForm';

/**
 * Claudio app-level settings component
 *
 * Demonstrates the new auto-save pattern - NO SAVE BUTTONS!
 * All changes are instantly persisted with optimistic updates.
 */
export function ClaudioAppSettings() {
  const fields: SettingsFieldConfig[] = [
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
      defaultValue: 'system',
      section: 'Appearance',
    },
    {
      key: 'telemetry',
      label: 'Enable Telemetry',
      description: 'Help improve Claudio by sharing anonymous usage data',
      type: 'boolean',
      defaultValue: true,
      section: 'Privacy',
    },
    {
      key: 'auto_update',
      label: 'Auto Update',
      description: 'Automatically download and install updates',
      type: 'boolean',
      defaultValue: true,
      section: 'Updates',
    },
    {
      key: 'default_project_path',
      label: 'Default Project Path',
      description: 'Default directory when opening projects',
      type: 'text',
      placeholder: '/Users/username/Projects',
      section: 'Projects',
    },
    {
      key: 'debug_mode',
      label: 'Debug Mode',
      description: 'Enable detailed logging for troubleshooting',
      type: 'boolean',
      defaultValue: false,
      section: 'Developer',
    },
  ];

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

      <AutoSaveSettingsForm
        settingsType="claudio"
        fields={fields}
        data-testid="claudio-app-settings"
      />

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          ✨ Auto-Save Enabled
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          Your settings are automatically saved as you make changes. No need to click a save button!
        </p>
      </div>
    </div>
  );
}

export default ClaudioAppSettings;