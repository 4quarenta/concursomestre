import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { questionNotesService } from '@/services/questions/questionNotesService';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import type { QuestionNote } from '@/types/notes';

const loadNotes = async (userId: string): Promise<QuestionNote[]> => {
  const [remoteNotes, localNotes] = await Promise.all([
    questionNotesService.listRemoteNotes(userId).catch(() => []),
    questionNotesService.listLocalNotes(userId),
  ]);

  return questionNotesService.mergeNotes(remoteNotes, localNotes);
};

export const useQuestionNotesQuery = (userId?: string) => useQuery({
  queryKey: questionQueryKeys.notes(userId),
  queryFn: () => loadNotes(userId as string),
  enabled: Boolean(userId),
  staleTime: 60_000,
});

export const useSaveQuestionNoteMutation = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, text, previous }: {
      questionId: number;
      text: string;
      previous?: QuestionNote;
    }) => {
      if (!userId) throw new Error('Sessao expirada. Faca login novamente.');
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Escreva uma anotacao antes de salvar.');

      const note: QuestionNote = {
        id: previous?.id || `local-${userId}-${questionId}`,
        questionId,
        text: trimmed,
        timestamp: Date.now(),
        remoteId: previous?.remoteId ?? null,
        source: previous?.remoteId ? 'local_override' : 'local',
      };

      await questionNotesService.upsertLocalNote(userId, note);
      return note;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<QuestionNote[]>(questionQueryKeys.notes(userId), (current = []) => {
        const withoutCurrent = current.filter((item) => Number(item.questionId) !== Number(note.questionId));
        return [note, ...withoutCurrent];
      });
    },
  });
};

export const useDeleteQuestionNoteMutation = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: QuestionNote) => {
      if (!userId) throw new Error('Sessao expirada. Faca login novamente.');
      if (note.remoteId) {
        await questionNotesService.deleteRemoteNote(note.remoteId);
      }
      await questionNotesService.removeLocalNote(userId, note.questionId);
      return note.questionId;
    },
    onSuccess: (questionId) => {
      queryClient.setQueryData<QuestionNote[]>(questionQueryKeys.notes(userId), (current = []) => (
        current.filter((item) => Number(item.questionId) !== Number(questionId))
      ));
    },
  });
};
