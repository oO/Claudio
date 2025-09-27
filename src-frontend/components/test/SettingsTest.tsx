/**
 * Test component to verify UnifiedSettings is working
 * This can be temporarily added to the app to test caching
 */

import React from 'react';
import { useThemeUnified } from '@/hooks/useThemeUnified';
import { useDebugUnified } from '@/hooks/useDebugUnified';

export const SettingsTest: React.FC = () => {
  const {
    theme,
    setTheme,
    debugMode,
    toggleDebug,
    loading,
    error,
    settings
  } = useThemeUnified();

  const debugHook = useDebugUnified();

  if (loading) {
    return <div>Loading settings...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Settings Test</h3>

      <div>
        <strong>Theme:</strong> {theme}
        <button onClick={() => setTheme('dark')} style={{ marginLeft: '10px' }}>
          Set Dark
        </button>
        <button onClick={() => setTheme('light')} style={{ marginLeft: '5px' }}>
          Set Light
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <strong>Debug Mode:</strong> {debugMode ? 'ON' : 'OFF'}
        <button onClick={toggleDebug} style={{ marginLeft: '10px' }}>
          Toggle Debug
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <strong>Debug Hook Test:</strong> {debugHook.isDebugMode ? 'ON' : 'OFF'}
        <button onClick={debugHook.toggleDebug} style={{ marginLeft: '10px' }}>
          Toggle (Hook2)
        </button>
      </div>

      <div style={{ marginTop: '10px', fontSize: '12px' }}>
        <strong>All Settings:</strong>
        <pre style={{ fontSize: '10px', maxWidth: '500px', overflow: 'auto' }}>
          {JSON.stringify(settings, null, 2)}
        </pre>
      </div>
    </div>
  );
};