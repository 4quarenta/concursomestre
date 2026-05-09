import { commentService } from '@services/comments';
import { userProgressService } from '@services/progress';

export interface UserProgressBundle {
  answers: Awaited<ReturnType<typeof userProgressService.getUserAnswers>>;
  comments: Awaited<ReturnType<typeof commentService.getUserComments>>;
  notes: Awaited<ReturnType<typeof userProgressService.getUserQuestionNotes>>;
}

export interface UserProgressFetchScope {
  includeAnswers?: boolean;
  includeComments?: boolean;
  includeNotes?: boolean;
}

const resolveScopeFlags = (scope?: UserProgressFetchScope) => ({
  includeAnswers: scope?.includeAnswers !== false,
  includeComments: scope?.includeComments !== false,
  includeNotes: scope?.includeNotes !== false,
});

const buildScopeKey = (scope?: UserProgressFetchScope) => {
  const flags = resolveScopeFlags(scope);
  return `a${flags.includeAnswers ? 1 : 0}-c${flags.includeComments ? 1 : 0}-n${flags.includeNotes ? 1 : 0}`;
};

export const buildUserProgressQueryKey = (userId: string, scope?: UserProgressFetchScope) => (
  ['user-progress', userId, buildScopeKey(scope)] as const
);

export const fetchUserProgressBundle = async (
  userId: string,
  scope?: UserProgressFetchScope,
): Promise<UserProgressBundle> => {
  const flags = resolveScopeFlags(scope);
  const [answers, comments, notes] = await Promise.all([
    flags.includeAnswers ? userProgressService.getUserAnswers(userId) : Promise.resolve([]),
    flags.includeComments ? commentService.getUserComments(userId) : Promise.resolve([]),
    flags.includeNotes ? userProgressService.getUserQuestionNotes(userId) : Promise.resolve([]),
  ]);

  return {
    answers: Array.isArray(answers) ? answers : [],
    comments: Array.isArray(comments) ? comments : [],
    notes: Array.isArray(notes) ? notes : [],
  };
};

export default fetchUserProgressBundle;
