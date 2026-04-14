import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type { QuestionNote } from '@/types/notes';

const STORAGE_PREFIX = 'cm_question_notes';

const buildStorageKey = (userId: string): string => `${STORAGE_PREFIX}:${userId}`;

const sortNotes = (notes: QuestionNote[]): QuestionNote[] => (
  [...notes].sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))
);

export const questionNotesService = {
  async listRemoteNotes(userId: string): Promise<QuestionNote[]> {
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.users.notes, {
        params: { userId },
      });

      const payload = readApiData<any>(response, {});
      const notes = Array.isArray(payload?.notes) ? payload.notes : [];

      return sortNotes(
        notes
          .filter((note: any) => note?.type === 'question')
          .map((note: any) => ({
            id: `remote-${String(note.id)}`,
            questionId: Number(note.itemId),
            text: String(note.text || ''),
            timestamp: new Date(note.updatedAt || Date.now()).getTime(),
            remoteId: String(note.id),
            source: 'remote' as const,
          }))
          .filter((note: QuestionNote) => Number.isFinite(note.questionId) && note.questionId > 0),
      );
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel carregar anotacoes.'));
    }
  },

  async listLocalNotes(userId: string): Promise<QuestionNote[]> {
    const rawValue = await AsyncStorage.getItem(buildStorageKey(userId));
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue) as QuestionNote[];
      if (!Array.isArray(parsed)) return [];

      return sortNotes(parsed.filter((note) => Number.isFinite(note.questionId) && note.questionId > 0));
    } catch {
      return [];
    }
  },

  async saveLocalNotes(userId: string, notes: QuestionNote[]): Promise<void> {
    const nextNotes = sortNotes(notes);
    if (nextNotes.length === 0) {
      await AsyncStorage.removeItem(buildStorageKey(userId));
      return;
    }

    await AsyncStorage.setItem(buildStorageKey(userId), JSON.stringify(nextNotes));
  },

  async upsertLocalNote(userId: string, note: QuestionNote): Promise<QuestionNote[]> {
    const existingNotes = await this.listLocalNotes(userId);
    const filtered = existingNotes.filter((item) => Number(item.questionId) !== Number(note.questionId));
    const nextNotes = sortNotes([note, ...filtered]);
    await this.saveLocalNotes(userId, nextNotes);
    return nextNotes;
  },

  async removeLocalNote(userId: string, questionId: number): Promise<QuestionNote[]> {
    const existingNotes = await this.listLocalNotes(userId);
    const nextNotes = existingNotes.filter((item) => Number(item.questionId) !== Number(questionId));
    await this.saveLocalNotes(userId, nextNotes);
    return nextNotes;
  },

  mergeNotes(remoteNotes: QuestionNote[], localNotes: QuestionNote[]): QuestionNote[] {
    const noteMap = new Map<number, QuestionNote>();

    remoteNotes.forEach((note) => {
      noteMap.set(Number(note.questionId), note);
    });

    localNotes.forEach((note) => {
      const existing = noteMap.get(Number(note.questionId));
      noteMap.set(Number(note.questionId), {
        ...existing,
        ...note,
        source: existing?.remoteId ? 'local_override' : 'local',
        remoteId: note.remoteId ?? existing?.remoteId ?? null,
      });
    });

    return sortNotes(Array.from(noteMap.values()));
  },

  async deleteRemoteNote(noteId: string): Promise<void> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.users.deleteNote, {
        id: noteId,
      });

      assertApiSuccess(response, 'Nao foi possivel remover a anotacao remota.');
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel remover a anotacao remota.'));
    }
  },
};

export default questionNotesService;
