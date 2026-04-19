/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * DebugLogger.ts
 * Captures console logs and API events for display in the DebugBanner
 */

export interface LogEntry {
  id: string;
  type: 'log' | 'error' | 'warn' | 'request' | 'response' | 'api-error';
  message: string;
  timestamp: Date;
  details?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class DebugLogger {
  private logs: LogEntry[] = [];
  private listeners: LogListener[] = [];
  private maxLogs = 100;

  constructor() {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      this.initInterceptors();
    }
  }

  private initInterceptors() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.addLog('error', `Runtime Error: ${event.message}`, {
        file: event.filename,
        line: event.lineno,
        col: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('error', `Promise Rejection: ${event.reason}`, event.reason);
    });
  }

  public addLog(type: LogEntry['type'], message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      timestamp: new Date(),
      details
    };

    this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
    this.notifyListeners();
  }

  public getLogs() {
    return this.logs;
  }

  public subscribe(listener: LogListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.logs));
  }

  public clear() {
    this.logs = [];
    this.notifyListeners();
  }
}

export const logger = new DebugLogger();
