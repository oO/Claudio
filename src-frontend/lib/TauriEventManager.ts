import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logger } from './logger';

/**
 * Represents a subscription to an event with optional filtering
 */
interface EventSubscription<T = any> {
  id: string;
  callback: (payload: T) => void;
  filter?: EventFilter;
}

/**
 * Filter options for event routing
 */
interface EventFilter {
  /** Route only events with this session_id */
  sessionId?: string;
  /** Route only events with this handle_id */
  handleId?: string;
  /** Route only events with this project_id */
  projectId?: string;
  /** Route only events with this claudio_id */
  claudioid?: string;
  /** Custom filter function */
  custom?: (payload: any) => boolean;
}

/**
 * Global singleton for managing all Tauri event listeners
 * 
 * Solves the problem of:
 * - Multiple duplicate listeners for the same event
 * - Lost events during React re-renders
 * - Complex cleanup logic scattered across components
 * - Difficulty debugging event flows
 */
class TauriEventManager {
  private static instance: TauriEventManager | null = null;
  
  /** Map of event names to their Tauri unlisten functions */
  private listeners = new Map<string, UnlistenFn>();
  
  /** Map of event names to sets of subscriptions */
  private subscriptions = new Map<string, Set<EventSubscription>>();
  
  /** Counter for generating unique subscription IDs */
  private subscriptionCounter = 0;
  
  /** Track last logged state to prevent spam */
  private lastLoggedState: string | null = null;
  
  private constructor() {
    logger.log('TauriEventManager singleton created');
  }
  
  static getInstance(): TauriEventManager {
    if (!TauriEventManager.instance) {
      TauriEventManager.instance = new TauriEventManager();
    }
    
    return TauriEventManager.instance;
  }
  
  /**
   * Log current state when it changes (not periodically)
   */
  private logStateIfChanged(): void {
    const debugInfo = this.getDebugInfo();
    const currentStateHash = JSON.stringify(debugInfo);
    
    if (this.lastLoggedState !== currentStateHash) {
      logger.log(`🔍 TauriEventManager State Changed:`, debugInfo);
      logger.log(`🔍 Active listeners: ${debugInfo.listeners.length}`, debugInfo.listeners);
      logger.log(`🔍 Active subscriptions:`, debugInfo.subscriptions);
      this.lastLoggedState = currentStateHash;
    }
  }
  
  /**
   * Subscribe to a Tauri event with optional filtering
   */
  async subscribe<T = any>(
    eventName: string,
    callback: (payload: T) => void,
    filter?: EventFilter
  ): Promise<() => void> {
    const subscriptionId = `${eventName}-${++this.subscriptionCounter}`;
    
    logger.log(`🎧 Subscribing to '${eventName}' with ID: ${subscriptionId}`, {
      filter,
      totalSubscriptions: this.getSubscriptionCount(eventName)
    });
    
    // Create subscription
    const subscription: EventSubscription<T> = {
      id: subscriptionId,
      callback,
      filter
    };
    
    // Add to subscriptions map
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set());
    }
    this.subscriptions.get(eventName)!.add(subscription);
    
    // Set up Tauri listener if this is the first subscription for this event
    if (!this.listeners.has(eventName)) {
      await this.setupTauriListener(eventName);
    }
    
    // Log state change after adding subscription
    this.logStateIfChanged();
    
    // Return unsubscribe function
    return () => this.unsubscribe(eventName, subscriptionId);
  }
  
  /**
   * Unsubscribe from an event
   */
  private async unsubscribe(eventName: string, subscriptionId: string): Promise<void> {
    logger.log(`🔇 Unsubscribing from '${eventName}' ID: ${subscriptionId}`);
    
    const subscriptionSet = this.subscriptions.get(eventName);
    if (!subscriptionSet) {
      logger.warn(`⚠️ No subscriptions found for event: ${eventName}`);
      return;
    }
    
    // Remove the specific subscription
    const subscription = Array.from(subscriptionSet).find(s => s.id === subscriptionId);
    if (subscription) {
      subscriptionSet.delete(subscription);
      logger.log(`✅ Removed subscription ${subscriptionId} for '${eventName}'`);
    }
    
    // If no more subscriptions, tear down the Tauri listener
    if (subscriptionSet.size === 0) {
      await this.teardownTauriListener(eventName);
      this.subscriptions.delete(eventName);
    }
    
    // Log state change after removing subscription
    this.logStateIfChanged();
  }
  
  /**
   * Set up a Tauri event listener for the given event name
   */
  private async setupTauriListener(eventName: string): Promise<void> {
    try {
      logger.log(`🚀 Setting up Tauri listener for '${eventName}'`);
      
      const unlisten = await listen(eventName, (event) => {
        logger.info(`🎯 Tauri listener received '${eventName}' event:`, event.payload);
        this.routeEvent(eventName, event.payload);
      });
      
      this.listeners.set(eventName, unlisten);
      logger.log(`✅ Tauri listener active for '${eventName}'`);
      
      // Log state change after setting up listener
      this.logStateIfChanged();
      
    } catch (error) {
      logger.error(`❌ Failed to setup Tauri listener for '${eventName}':`, error);
      throw error;
    }
  }
  
  /**
   * Tear down a Tauri event listener
   */
  private async teardownTauriListener(eventName: string): Promise<void> {
    const unlisten = this.listeners.get(eventName);
    if (unlisten) {
      try {
        await unlisten();
        this.listeners.delete(eventName);
        logger.log(`🧹 Torn down Tauri listener for '${eventName}'`);
        
        // Log state change after tearing down listener
        this.logStateIfChanged();
      } catch (error) {
        logger.error(`❌ Failed to teardown Tauri listener for '${eventName}':`, error);
      }
    }
  }
  
  /**
   * Route an event to all matching subscriptions
   */
  private routeEvent(eventName: string, payload: any): void {
    const subscriptionSet = this.subscriptions.get(eventName);
    if (!subscriptionSet || subscriptionSet.size === 0) {
      logger.warn(`📭 Received event '${eventName}' but no subscriptions exist`);
      return;
    }
    
    // Debug logging for session file events
    if (eventName === 'session-file-changed') {
      logger.debug(`🔍 Routing session-file-changed event:`, payload);
    }
    
    // Special logging for thinking events
    if (eventName === 'claude-session-thinking') {
      logger.info(`🧠 THINKING EVENT ROUTING: payload=`, payload);
    }
    
    logger.log(`📨 Routing event '${eventName}' to ${subscriptionSet.size} subscription(s)`);
    
    let routedCount = 0;
    let filteredOutCount = 0;
    
    for (const subscription of subscriptionSet) {      
      if (this.matchesFilter(subscription.filter, payload)) {
        try {
          // Execute callback for subscription
          subscription.callback(payload);
          routedCount++;
        } catch (error) {
          logger.error(`❌ Error in event callback for '${eventName}' subscription ${subscription.id}:`, error);
        }
      } else {
        filteredOutCount++;
      }
    }
    
    logger.log(`✅ Event '${eventName}' routed to ${routedCount}/${subscriptionSet.size} subscriptions (${filteredOutCount} filtered out)`);
  }
  
  /**
   * Check if an event payload matches a subscription filter
   */
  private matchesFilter(filter: EventFilter | undefined, payload: any): boolean {
    if (!filter) {
      return true; // No filter = match all
    }
    
    // Check sessionId filter
    if (filter.sessionId) {
      const eventSessionId = payload.session_id || payload.data?.session_id;
      if (eventSessionId !== filter.sessionId) {
        return false;
      }
    }
    
    // Check handleId filter
    if (filter.handleId && payload.handle_id !== filter.handleId) {
      return false;
    }
    
    // Check projectId filter (handle both direct and nested structures)
    if (filter.projectId) {
      const eventProjectId = payload.project_id || 
                           payload.data?.project_id ||
                           payload.Modified?.project_id || 
                           payload.Created?.project_id || 
                           payload.Removed?.project_id;
      if (eventProjectId !== filter.projectId) {
        return false;
      }
    }
    
    // Check claudioid filter
    if (filter.claudioid && payload.claudio_id !== filter.claudioid) {
      return false;
    }
    
    // Check custom filter
    if (filter.custom && !filter.custom(payload)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get current subscription count for an event (for debugging)
   */
  private getSubscriptionCount(eventName: string): number {
    return this.subscriptions.get(eventName)?.size ?? 0;
  }
  
  /**
   * Get debug info about current state
   */
  getDebugInfo(): { listeners: string[], subscriptions: Record<string, number> } {
    const listeners = Array.from(this.listeners.keys());
    const subscriptions: Record<string, number> = {};
    
    for (const [eventName, subscriptionSet] of this.subscriptions) {
      subscriptions[eventName] = subscriptionSet.size;
    }
    
    return { listeners, subscriptions };
  }
  
  /**
   * Emergency cleanup - tear down all listeners (for debugging)
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('🚨 Emergency cleanup of all Tauri listeners');
    
    for (const [eventName, unlisten] of this.listeners) {
      try {
        await unlisten();
        logger.log(`🧹 Emergency cleanup: removed listener for '${eventName}'`);
      } catch (error) {
        logger.error(`❌ Emergency cleanup failed for '${eventName}':`, error);
      }
    }
    
    this.listeners.clear();
    this.subscriptions.clear();
    logger.log('✅ Emergency cleanup completed');
  }
}

// Export singleton instance
export const eventManager = TauriEventManager.getInstance();

// For debugging in dev tools
if (typeof window !== 'undefined') {
  (window as any).__tauriEventManager = eventManager;
}