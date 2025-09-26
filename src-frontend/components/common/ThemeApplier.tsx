/**
 * Component that applies theme to DOM on startup
 * Uses UnifiedSettings to get cached theme and applies it
 */

import { useEffect } from 'react';
import { useThemeUnified } from '@/hooks/useThemeUnified';

export const ThemeApplier: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, loading } = useThemeUnified();

  // Theme is applied automatically in useThemeUnified via useEffect
  // This component just ensures the hook is called at app level

  if (loading) {
    // Show loading state while theme is being applied
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return <>{children}</>;
};