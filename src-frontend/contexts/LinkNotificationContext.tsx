import React, { useContext, createContext } from 'react';
import { logger } from '@/lib/logger';

interface LinkNotificationContextValue {
  notifyLinkDetected: (url: string) => void;
}

export const LinkNotificationContext = createContext<LinkNotificationContextValue | null>(null);

interface LinkNotificationProviderProps {
  children: React.ReactNode;
  onLinkDetected: (url: string) => void;
}

/**
 * Provider that allows leaf components to notify about detected links
 * without prop drilling through components that don't care about links
 */
export const LinkNotificationProvider: React.FC<LinkNotificationProviderProps> = ({
  children,
  onLinkDetected,
}) => {
  const value = {
    notifyLinkDetected: onLinkDetected,
  };

  return (
    <LinkNotificationContext.Provider value={value}>
      {children}
    </LinkNotificationContext.Provider>
  );
};

/**
 * Hook for components that detect links in content to notify the session
 * This eliminates prop drilling - only components that actually detect links need this
 */
export const useLinkNotification = (): ((url: string) => void) => {
  const context = useContext(LinkNotificationContext);
  if (!context) {
    // Graceful degradation - if no provider, just log
    return (url: string) => {
      logger.info('Link detected but no notification handler:', url);
    };
  }
  return context.notifyLinkDetected;
};