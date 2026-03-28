/**
 * Statistics Feature Module
 * Public API exports for statistics feature
 */

// Context and hooks
export { StatisticsProvider, useStatistics as useStatisticsContext } from './context/StatisticsContext';
export { useStatistics } from './hooks/useStatistics';

// Services
export { statisticsService } from './services/statisticsService';

// Types
export type * from './types';
