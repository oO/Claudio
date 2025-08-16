import { invoke } from '@tauri-apps/api/core';

/**
 * Frontend logger that routes all logging through the Tauri backend
 * Drop-in replacement for console with the same API
 */
class FrontendLogger {
  private async sendLog(level: 'info' | 'warn' | 'error' | 'debug', component: string, ...args: any[]) {
    try {
      // Convert arguments to a structured format
      const data = {
        level,
        timestamp: new Date().toISOString(),
        args: args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.parse(JSON.stringify(arg));
            } catch {
              return String(arg);
            }
          }
          return arg;
        })
      };

      await invoke('log_frontend_debug', {
        component: `${component}:${level.toUpperCase()}`,
        data
      });
    } catch (err) {
      // Fallback to console if backend logging fails
      console.error('Failed to send log to backend:', err);
      console[level === 'debug' ? 'log' : level](...args);
    }
  }

  private getCallerComponent(): string {
    const stack = new Error().stack;
    if (!stack) return 'Unknown';
    
    const lines = stack.split('\n');
    // Find the first line that's not from this logger file
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('logger.ts') && !line.includes('Logger')) {
        // Extract component name from file path
        const match = line.match(/\/([^\/]+)\.tsx?:/);
        if (match) {
          return match[1];
        }
        // Fallback to a simpler extraction
        const simpleMatch = line.match(/([^\/\s]+)\.(tsx?|js):/);
        if (simpleMatch) {
          return simpleMatch[1];
        }
      }
    }
    return 'Unknown';
  }

  /**
   * Log an informational message
   */
  log(...args: any[]) {
    this.sendLog('info', this.getCallerComponent(), ...args);
  }

  /**
   * Log an informational message  
   */
  info(...args: any[]) {
    this.sendLog('info', this.getCallerComponent(), ...args);
  }

  /**
   * Log a warning message
   */
  warn(...args: any[]) {
    this.sendLog('warn', this.getCallerComponent(), ...args);
  }

  /**
   * Log an error message
   */
  error(...args: any[]) {
    this.sendLog('error', this.getCallerComponent(), ...args);
  }

  /**
   * Log a debug message
   */
  debug(...args: any[]) {
    this.sendLog('debug', this.getCallerComponent(), ...args);
  }
}

/**
 * Drop-in replacement for console
 * Usage: import { logger } from '@/lib/logger'; logger.log('hello');
 */
export const logger = new FrontendLogger();

/**
 * For backwards compatibility, also export as console-like object
 */
export const frontendConsole = logger;