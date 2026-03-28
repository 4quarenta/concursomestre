/**
 * Bank Analysis (Raio-X) Feature Module
 * Public API exports for exam board analysis feature
 */

// Context and hooks
export { BankAnalysisProvider, useBankAnalysis } from './context/BankAnalysisContext';

// Hooks
export { useAnalytics } from './hooks/useAnalytics';
export { usePatternDetection } from './hooks/usePatternDetection';

// Services
export { bankAnalysisService } from './services/bankAnalysisService';

// Components will be migrated in Phase 5
// export { BankAnalysisChart } from './components/BankAnalysisChart';
// export { PatternInsights } from './components/PatternInsights';

// Types
export type * from './types';
