/**
 * Global debug context - loads debug setting ONCE and shares with all components
 * Replaces the disaster of having every DebugLabel make individual API calls
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from '@/lib/api';
import { logger } from '@/lib/logger';

interface DebugContextState {
  isDebugMode: boolean;
  toggleDebug: () => void;
}

const DebugContext = createContext<DebugContextState | undefined>(undefined);

interface DebugProviderProps {
  children: ReactNode;
}

export function DebugProvider({ children }: DebugProviderProps) {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    // Load initial debug mode from settings ONCE
    const loadDebugMode = async () => {
      try {
        const saved = await api.loadClaudioAppSetting('debugMode');
        const debugEnabled = saved === 'true';
        setIsDebugMode(debugEnabled);
      } catch (error) {
        logger.warn('Failed to load debug mode, defaulting to false:', error);
        setIsDebugMode(false);
      }
    };

    loadDebugMode();

    // Listen for debug mode changes from the global toggle
    const handleDebugModeChanged = (event: CustomEvent<boolean>) => {
      setIsDebugMode(event.detail);
    };

    window.addEventListener('debugModeChanged', handleDebugModeChanged as EventListener);

    return () => {
      window.removeEventListener('debugModeChanged', handleDebugModeChanged as EventListener);
    };
  }, []);

  const toggleDebug = () => {
    // Use the global toggle function if available
    if ((window as any).toggleDebug) {
      (window as any).toggleDebug();
    } else {
      // Fallback for direct component usage
      const newDebugMode = !isDebugMode;
      api.saveClaudioAppSetting('debugMode', newDebugMode.toString())
        .then(() => {
          setIsDebugMode(newDebugMode);
          window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newDebugMode }));
          logger.log(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`);
        })
        .catch((error) => {
          logger.error('Failed to save debug mode:', error);
        });
    }
  };

  return (
    <DebugContext.Provider value={{ isDebugMode, toggleDebug }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebugContext() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebugContext must be used within a DebugProvider');
  }
  return context;
}