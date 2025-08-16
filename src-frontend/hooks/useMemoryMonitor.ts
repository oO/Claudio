import { useEffect, useRef, useState } from 'react';
import { api, type SystemMemoryInfo } from '@/lib/api';
import { logger } from '@/lib/logger';

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  component?: string;
  sessionCount?: number;
  virtualizedItems?: number;
  // System memory info from backend
  systemMemory?: SystemMemoryInfo;
}

export interface MemoryMonitorOptions {
  interval?: number; // milliseconds
  logToConsole?: boolean;
  trackLeaks?: boolean;
  component?: string;
}

export const useMemoryMonitor = (options: MemoryMonitorOptions = {}) => {
  const {
    interval = 5000,
    logToConsole = true,
    trackLeaks = true,
    component
  } = options;

  const [currentMemory, setCurrentMemory] = useState<MemorySnapshot | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<MemorySnapshot[]>([]);
  const [isLeakDetected, setIsLeakDetected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const baselineRef = useRef<number>(0);
  const leakThresholdRef = useRef<number>(100 * 1024 * 1024); // 100MB growth threshold

  const getMemorySnapshot = async (additionalData?: Partial<MemorySnapshot>): Promise<MemorySnapshot> => {
    // Try different ways to access memory info
    const performance = (window.performance as any);
    const memory = performance?.memory || (performance as any)?.webkitMemory;
    
    let browserMemory = {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    };
    
    if (memory) {
      browserMemory = {
        usedJSHeapSize: memory.usedJSHeapSize || 0,
        totalJSHeapSize: memory.totalJSHeapSize || 0,
        jsHeapSizeLimit: memory.jsHeapSizeLimit || (2048 * 1024 * 1024)
      };
    } else {
      // Try to get system memory info from backend as fallback
      try {
        const systemInfo = await api.getSystemMemoryInfo();
        const processMemoryBytes = systemInfo.process_memory_mb * 1024 * 1024;
        
        browserMemory = {
          usedJSHeapSize: processMemoryBytes * 0.7, // Estimate JS heap as 70% of process memory
          totalJSHeapSize: processMemoryBytes,
          jsHeapSizeLimit: systemInfo.system_total_mb * 1024 * 1024 * 0.8 // 80% of system memory
        };
        
        return {
          timestamp: Date.now(),
          ...browserMemory,
          component,
          systemMemory: systemInfo,
          ...additionalData
        };
      } catch (error) {
        logger.warn('Failed to get system memory info:', error);
        
        // Final fallback with reasonable estimates
        browserMemory = {
          usedJSHeapSize: 120 * 1024 * 1024, // 120MB
          totalJSHeapSize: 160 * 1024 * 1024, // 160MB
          jsHeapSizeLimit: 2048 * 1024 * 1024 // 2GB
        };
      }
    }

    return {
      timestamp: Date.now(),
      ...browserMemory,
      component,
      ...additionalData
    };
  };

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const detectMemoryLeak = (snapshots: MemorySnapshot[]): boolean => {
    if (snapshots.length < 5) return false;

    const recent = snapshots.slice(-5);
    const baseline = recent[0].usedJSHeapSize;
    const current = recent[recent.length - 1].usedJSHeapSize;
    const growth = current - baseline;

    // Check if memory consistently grew by more than threshold
    let consistentGrowth = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].usedJSHeapSize > recent[i - 1].usedJSHeapSize) {
        consistentGrowth++;
      }
    }

    return growth > leakThresholdRef.current && consistentGrowth >= 3;
  };

  const logMemorySnapshot = (snapshot: MemorySnapshot) => {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit, component: comp, sessionCount, virtualizedItems } = snapshot;
    
    const usage = ((usedJSHeapSize / jsHeapSizeLimit) * 100).toFixed(1);
    let logMsg = `[Memory${comp ? ` - ${comp}` : ''}] Used: ${formatBytes(usedJSHeapSize)} (${usage}%) | Total: ${formatBytes(totalJSHeapSize)} | Limit: ${formatBytes(jsHeapSizeLimit)}`;
    
    if (sessionCount !== undefined) {
      logMsg += ` | Sessions: ${sessionCount}`;
    }
    if (virtualizedItems !== undefined) {
      logMsg += ` | Virtual Items: ${virtualizedItems}`;
    }

    logger.log(logMsg);

    // Warn if memory usage is high
    if (parseFloat(usage) > 80) {
      logger.warn(`⚠️ High memory usage detected: ${usage}%`);
    }

    // Set baseline if not set
    if (baselineRef.current === 0) {
      baselineRef.current = usedJSHeapSize;
    }

    // Check growth from baseline
    const growthFromBaseline = usedJSHeapSize - baselineRef.current;
    if (growthFromBaseline > leakThresholdRef.current) {
      logger.warn(`🚨 Potential memory leak: ${formatBytes(growthFromBaseline)} growth from baseline`);
    }
  };

  useEffect(() => {
    const monitor = async () => {
      const snapshot = await getMemorySnapshot();
      setCurrentMemory(snapshot);
      
      setMemoryHistory(prev => {
        const newHistory = [...prev, snapshot];
        // Keep only last 50 snapshots to prevent memory usage by monitoring itself
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        
        if (trackLeaks) {
          const leakDetected = detectMemoryLeak(newHistory);
          if (leakDetected !== isLeakDetected) {
            setIsLeakDetected(leakDetected);
            if (leakDetected && logToConsole) {
              logger.error('🔥 MEMORY LEAK DETECTED - Memory consistently growing!');
            }
          }
        }
        
        return newHistory;
      });

      if (logToConsole) {
        logMemorySnapshot(snapshot);
      }
    };

    // Initial snapshot
    monitor();

    // Start monitoring
    intervalRef.current = setInterval(monitor, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, logToConsole, trackLeaks, component, isLeakDetected]);

  const forceGC = () => {
    if ((window as any).gc) {
      logger.log('🧹 Forcing garbage collection...');
      (window as any).gc();
    } else {
      logger.warn('Garbage collection not available. Start Chrome with --expose-gc flag.');
    }
  };

  const takeSnapshot = async (additionalData?: Partial<MemorySnapshot>) => {
    const snapshot = await getMemorySnapshot(additionalData);
    if (logToConsole) {
      logMemorySnapshot(snapshot);
    }
    return snapshot;
  };

  const getMemoryTrend = (): 'stable' | 'growing' | 'shrinking' => {
    if (memoryHistory.length < 3) return 'stable';
    
    const recent = memoryHistory.slice(-3);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    const diff = last - first;
    const threshold = 10 * 1024 * 1024; // 10MB threshold
    
    if (diff > threshold) return 'growing';
    if (diff < -threshold) return 'shrinking';
    return 'stable';
  };

  return {
    currentMemory,
    memoryHistory,
    isLeakDetected,
    takeSnapshot,
    forceGC,
    getMemoryTrend,
    formatBytes
  };
};