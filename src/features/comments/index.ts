/**
 * Comments Feature Module
 * Public API exports for comments feature
 */

// Context and hooks
export { CommentsProvider, useComments } from './context/CommentsContext';
export { useCommentActions } from './hooks/useCommentActions';

// Services
export { commentService } from './services/commentService';

// Components will be migrated in Phase 5
// export { CommentsSection } from './components/CommentsSection';

// Types
export type * from './types';
