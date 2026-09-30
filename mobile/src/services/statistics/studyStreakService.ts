import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StudyStreakSnapshot {
  current: number;
  best: number;
  lastVisitDate: string;
}

const EMPTY: StudyStreakSnapshot = { current: 0, best: 0, lastVisitDate: '' };
const storageKey = (userId: string) => `cm-study-streak:${userId}`;

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const daysBetween = (current: string, previous: string): number => {
  if (!current || !previous) return Number.POSITIVE_INFINITY;
  const [cy, cm, cd] = current.split('-').map(Number);
  const [py, pm, pd] = previous.split('-').map(Number);
  return Math.round((Date.UTC(cy, cm - 1, cd) - Date.UTC(py, pm - 1, pd)) / 86_400_000);
};

const read = async (userId: string): Promise<StudyStreakSnapshot> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const value = JSON.parse(raw) as Partial<StudyStreakSnapshot>;
    return {
      current: Math.max(0, Number(value.current) || 0),
      best: Math.max(0, Number(value.best) || 0),
      lastVisitDate: String(value.lastVisitDate || ''),
    };
  } catch {
    return EMPTY;
  }
};

/** Replica a regra web: primeiro acesso inicia em 1, mesmo dia não altera, dia seguinte soma, falta reinicia. */
export const touchStudyStreak = async (userId: string, now = new Date()): Promise<StudyStreakSnapshot> => {
  const id = String(userId || '').trim();
  if (!id) return EMPTY;
  const previous = await read(id);
  const today = dateKey(now);
  const difference = daysBetween(today, previous.lastVisitDate);
  if (difference === 0) return previous;

  const current = difference === 1 ? previous.current + 1 : 1;
  const next = {
    current,
    best: Math.max(previous.best, current),
    lastVisitDate: today,
  };
  await AsyncStorage.setItem(storageKey(id), JSON.stringify(next));
  return next;
};
