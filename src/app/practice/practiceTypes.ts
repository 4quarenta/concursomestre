import type { Question } from '@types';

export interface PracticeInitialQuestionPage {
  questions: Question[];
  total: number;
  pageInfo: {
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}
