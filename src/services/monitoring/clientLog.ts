'use client';

import { logger } from '@/utils/helpers/DebugLogger';

type ClientLogLevel = 'error' | 'warn';

const VERBOSE_STORAGE_KEY = 'cm:debug-logs';

const shouldPrintToConsole = (): boolean => {
  if (process.env.NEXT_PUBLIC_CLIENT_LOGS === 'verbose') {
    return true;
  }

  if (typeof window === 'undefined') {
    return process.env.NODE_ENV !== 'production';
  }

  try {
    return window.localStorage.getItem(VERBOSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const addDebugLog = (level: ClientLogLevel, message: string, details: unknown[]): void => {
  logger.addLog(level, message, details.length <= 1 ? details[0] : details);
};

export const clientLog = {
  error(message: string, ...details: unknown[]) {
    addDebugLog('error', message, details);
    if (shouldPrintToConsole()) {
      console.error(message, ...details);
    }
  },
  warn(message: string, ...details: unknown[]) {
    addDebugLog('warn', message, details);
    if (shouldPrintToConsole()) {
      console.warn(message, ...details);
    }
  },
};
