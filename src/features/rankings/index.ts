/**
 * Rankings Feature Module
 * Public API exports for rankings and leaderboards feature
 */

// Context and hooks
// TODO: Create RankingsContext when needed
// export { RankingsProvider, useRankings } from './context/RankingsContext';

// Services
export { rankingsService } from './services/rankingsService';

// Components will be migrated in Phase 5
// export { RankingTable } from './components/RankingTable';
// export { RankingCard } from './components/RankingCard';

// Types - Export from main types.ts (post-exam ranking types)
export type { Ranking, RankingEntry } from '../../../types';
