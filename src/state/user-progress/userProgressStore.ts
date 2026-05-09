'use client';

import { create } from 'zustand';
import type { QuestaoComentario, UserAnswer, UserNote } from '@types';

interface UserProgressState {
  loadedUserId: string | null;
  loadedSlices: {
    answers: boolean;
    comments: boolean;
    notes: boolean;
  };
  userAnswers: UserAnswer[];
  userComments: QuestaoComentario[];
  userNotes: UserNote[];
  isUserProgressLoaded: boolean;
  replaceUserProgress: (userId: string, payload: {
    answers: UserAnswer[];
    comments: QuestaoComentario[];
    notes: UserNote[];
  }, loaded?: {
    answers?: boolean;
    comments?: boolean;
    notes?: boolean;
  }) => void;
  setUserComments: (userId: string, comments: QuestaoComentario[]) => void;
  upsertUserAnswer: (answer: UserAnswer) => void;
  saveUserQuestionNote: (questionId: number, text: string) => void;
  removeQuestionProgress: (questionId: number | string) => void;
  resetAnswersAndNotes: () => void;
  resetUserProgress: () => void;
}

const buildNewNote = (questionId: number, text: string): UserNote => ({
  id: `note-${Date.now()}`,
  questionId: Number(questionId),
  text,
  timestamp: Date.now(),
});

/**
 * Store especializado para progresso do usuario.
 * Ele concentra respostas, comentarios do perfil e notas, tirando esse dominio do DataProvider aos poucos.
 *
 * @since 1.0.0
 */
export const useUserProgressStore = create<UserProgressState>((set) => ({
  loadedUserId: null,
  loadedSlices: {
    answers: false,
    comments: false,
    notes: false,
  },
  userAnswers: [],
  userComments: [],
  userNotes: [],
  isUserProgressLoaded: false,
  replaceUserProgress: (userId, payload, loaded) => set((state) => {
    const sameUser = state.loadedUserId === userId;
    const nextLoaded = {
      answers: loaded?.answers !== false,
      comments: loaded?.comments !== false,
      notes: loaded?.notes !== false,
    };

    const previousLoadedSlices = sameUser
      ? state.loadedSlices
      : { answers: false, comments: false, notes: false };

    const mergedLoadedSlices = {
      answers: previousLoadedSlices.answers || nextLoaded.answers,
      comments: previousLoadedSlices.comments || nextLoaded.comments,
      notes: previousLoadedSlices.notes || nextLoaded.notes,
    };

    return {
      loadedUserId: userId,
      loadedSlices: mergedLoadedSlices,
      userAnswers: nextLoaded.answers ? payload.answers : (sameUser ? state.userAnswers : []),
      userComments: nextLoaded.comments ? payload.comments : (sameUser ? state.userComments : []),
      userNotes: nextLoaded.notes ? payload.notes : (sameUser ? state.userNotes : []),
      isUserProgressLoaded: mergedLoadedSlices.answers || mergedLoadedSlices.comments || mergedLoadedSlices.notes,
    };
  }),
  setUserComments: (userId, comments) => set((state) => ({
    loadedUserId: userId || state.loadedUserId,
    loadedSlices: {
      ...state.loadedSlices,
      comments: true,
    },
    userComments: comments,
    isUserProgressLoaded: state.isUserProgressLoaded || Boolean(userId),
  })),
  upsertUserAnswer: (answer) => set((state) => ({
    userAnswers: [
      ...state.userAnswers.filter((item) => Number(item.questionId) !== Number(answer.questionId)),
      answer,
    ],
  })),
  saveUserQuestionNote: (questionId, text) => set((state) => {
    const filteredNotes = state.userNotes.filter((note) => Number(note.questionId) !== Number(questionId));
    if (text.trim() === '') {
      return { userNotes: filteredNotes };
    }

    return {
      userNotes: [...filteredNotes, buildNewNote(questionId, text)],
    };
  }),
  removeQuestionProgress: (questionId) => set((state) => ({
    userAnswers: state.userAnswers.filter((answer) => Number(answer.questionId) !== Number(questionId)),
    userComments: state.userComments.filter((comment) => {
      if (!Object.prototype.hasOwnProperty.call(comment, 'questionId')) {
        return true;
      }

      const commentQuestionId = (comment as QuestaoComentario & { questionId?: number | string }).questionId;
      return Number(commentQuestionId) !== Number(questionId);
    }),
    userNotes: state.userNotes.filter((note) => Number(note.questionId) !== Number(questionId)),
  })),
  resetAnswersAndNotes: () => set({
    userAnswers: [],
    userNotes: [],
  }),
  resetUserProgress: () => set({
    loadedUserId: null,
    loadedSlices: {
      answers: false,
      comments: false,
      notes: false,
    },
    userAnswers: [],
    userComments: [],
    userNotes: [],
    isUserProgressLoaded: false,
  }),
}));

export default useUserProgressStore;
