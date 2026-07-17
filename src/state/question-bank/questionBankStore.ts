'use client';

import { create } from 'zustand';
import { commentService } from '@services/comments';
import type { QuestaoComentario, Question, QuestionStats } from '@types';

interface ReplaceQuestionBankPayload {
  questions: Question[];
  totalQuestions: number;
  hasMoreQuestions?: boolean;
  nextQuestionCursor?: string | null;
}

interface QuestionBankState {
  loadedOwnerKey: string | null;
  questions: Question[];
  totalQuestions: number;
  hasMoreQuestions: boolean;
  nextQuestionCursor: string | null;
  isQuestionsLoaded: boolean;
  replaceQuestionBank: (ownerKey: string, payload: ReplaceQuestionBankPayload) => void;
  appendQuestions: (
    ownerKey: string,
    questions: Question[],
    totalQuestions?: number,
    hasMoreQuestions?: boolean,
    nextQuestionCursor?: string | null,
  ) => void;
  prependQuestion: (question: Question) => void;
  upsertQuestion: (question: Question) => void;
  removeQuestion: (questionId: number | string) => void;
  applyAnswer: (questionId: number | string, isCorrect: boolean) => void;
  setQuestionComments: (questionId: number | string, comments: QuestaoComentario[]) => void;
  addQuestionComment: (questionId: number | string, comment: QuestaoComentario, parentId?: string) => void;
  deleteQuestionComment: (questionId: number | string, commentId: string) => void;
  toggleSavedQuestion: (questionId: number | string) => void;
  likeQuestionComment: (questionId: number | string, commentId: string) => void;
  resetQuestionBank: () => void;
}

const getSafeStats = (stats?: QuestionStats): QuestionStats => ({
  totalAttempts: Number(stats?.totalAttempts || 0),
  correctCount: Number(stats?.correctCount || 0),
  wrongCount: Number(stats?.wrongCount || 0),
  optionDistribution: stats?.optionDistribution || {},
});

const normalizeQuestionForStore = (question: Question): Question => ({
  ...question,
  comments: question.comments ?? null,
});

const mergeUniqueQuestions = (current: Question[], incoming: Question[]): Question[] => {
  const merged = [...current];
  const existingIds = new Set(current.map((question) => String(question.id ?? '')));

  incoming.forEach((question) => {
    const key = String(question.id ?? '');
    if (key && existingIds.has(key)) {
      return;
    }

    merged.push(normalizeQuestionForStore(question));
    if (key) {
      existingIds.add(key);
    }
  });

  return merged;
};

const resolveDifficultyFromAccuracy = (accuracy: number, currentDifficulty: number): number => {
  if (accuracy > 0.85) return 1;
  if (accuracy > 0.65) return 2;
  if (accuracy > 0.45) return 3;
  if (accuracy > 0.25) return 4;
  if (accuracy >= 0) return 5;
  return currentDifficulty;
};

const filterOutCommentTree = (comments: QuestaoComentario[], commentId: string): QuestaoComentario[] => (
  comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: filterOutCommentTree(comment.replies || [], commentId),
    }))
);

export const useQuestionBankStore = create<QuestionBankState>((set) => ({
  loadedOwnerKey: null,
  questions: [],
  totalQuestions: 0,
  hasMoreQuestions: false,
  nextQuestionCursor: null,
  isQuestionsLoaded: false,
  replaceQuestionBank: (ownerKey, payload) => set({
    loadedOwnerKey: ownerKey,
    questions: payload.questions.map(normalizeQuestionForStore),
    totalQuestions: payload.totalQuestions,
    hasMoreQuestions: Boolean(payload.hasMoreQuestions),
    nextQuestionCursor: payload.nextQuestionCursor ?? null,
    isQuestionsLoaded: true,
  }),
  appendQuestions: (ownerKey, incoming, totalQuestions, hasMoreQuestions, nextQuestionCursor) => set((state) => {
    const questions = mergeUniqueQuestions(state.questions, incoming);
    return {
      loadedOwnerKey: ownerKey,
      questions,
      totalQuestions: typeof totalQuestions === 'number'
        ? Math.max(totalQuestions, questions.length)
        : Math.max(state.totalQuestions, questions.length),
      hasMoreQuestions: typeof hasMoreQuestions === 'boolean' ? hasMoreQuestions : state.hasMoreQuestions,
      nextQuestionCursor: nextQuestionCursor === undefined ? state.nextQuestionCursor : nextQuestionCursor,
      isQuestionsLoaded: true,
    };
  }),
  prependQuestion: (question) => set((state) => ({
    questions: [normalizeQuestionForStore(question), ...state.questions],
    totalQuestions: state.totalQuestions + 1,
    isQuestionsLoaded: true,
  })),
  upsertQuestion: (question) => set((state) => ({
    questions: state.questions.some((item) => Number(item.id) === Number(question.id))
      ? state.questions.map((item) => (
        Number(item.id) === Number(question.id) ? normalizeQuestionForStore(question) : item
      ))
      : [normalizeQuestionForStore(question), ...state.questions],
    totalQuestions: state.questions.some((item) => Number(item.id) === Number(question.id))
      ? state.totalQuestions
      : state.totalQuestions + 1,
    isQuestionsLoaded: true,
  })),
  removeQuestion: (questionId) => set((state) => ({
    questions: state.questions.filter((question) => Number(question.id) !== Number(questionId)),
    totalQuestions: Math.max(0, state.totalQuestions - 1),
  })),
  applyAnswer: (questionId, isCorrect) => set((state) => ({
    questions: state.questions.map((question) => {
      if (Number(question.id) !== Number(questionId)) {
        return question;
      }

      const stats = getSafeStats(question.stats);
      const totalAttempts = stats.totalAttempts + 1;
      const correctCount = stats.correctCount + (isCorrect ? 1 : 0);
      const wrongCount = stats.wrongCount + (isCorrect ? 0 : 1);
      const accuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

      return {
        ...question,
        dificuldade: resolveDifficultyFromAccuracy(accuracy, question.dificuldade),
        stats: {
          totalAttempts,
          correctCount,
          wrongCount,
          optionDistribution: stats.optionDistribution,
        },
      };
    }),
  })),
  setQuestionComments: (questionId, comments) => set((state) => ({
    questions: state.questions.map((question) => (
      Number(question.id) === Number(questionId)
        ? {
          ...question,
          comments,
          commentsCount: comments.filter((comment) => !comment.parentId).length,
        }
        : question
    )),
  })),
  addQuestionComment: (questionId, comment, parentId) => set((state) => ({
    questions: state.questions.map((question) => {
      if (Number(question.id) !== Number(questionId)) {
        return question;
      }

      const currentComments = question.comments || [];
      const nextComments = parentId
        ? commentService.addReplyToComments(currentComments, parentId, comment)
        : [comment, ...currentComments];

      return {
        ...question,
        comments: nextComments,
        commentsCount: nextComments.filter((item) => !item.parentId).length,
      };
    }),
  })),
  deleteQuestionComment: (questionId, commentId) => set((state) => ({
    questions: state.questions.map((question) => {
      if (Number(question.id) !== Number(questionId)) {
        return question;
      }

      const nextComments = filterOutCommentTree(question.comments || [], commentId);
      return {
        ...question,
        comments: nextComments,
        commentsCount: nextComments.filter((comment) => !comment.parentId).length,
      };
    }),
  })),
  toggleSavedQuestion: (questionId) => set((state) => ({
    questions: state.questions.map((question) => {
      if (Number(question.id) !== Number(questionId)) {
        return question;
      }

      const nextIsSaved = !question.isSaved;
      const currentSavedCount = Number(question.savedCount || 0);
      const nextSavedCount = nextIsSaved
        ? currentSavedCount + 1
        : Math.max(0, currentSavedCount - 1);

      return {
        ...question,
        isSaved: nextIsSaved,
        savedCount: nextSavedCount,
      };
    }),
  })),
  likeQuestionComment: (questionId, commentId) => set((state) => ({
    questions: state.questions.map((question) => (
      Number(question.id) === Number(questionId)
        ? {
          ...question,
          comments: commentService.likeCommentInTree(question.comments, commentId),
        }
        : question
    )),
  })),
  resetQuestionBank: () => set({
    loadedOwnerKey: null,
    questions: [],
    totalQuestions: 0,
    hasMoreQuestions: false,
    nextQuestionCursor: null,
    isQuestionsLoaded: false,
  }),
}));

export default useQuestionBankStore;
