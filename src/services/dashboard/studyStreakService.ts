/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

export interface StudyStreakSnapshot {
  current: number;
  best: number;
  lastVisitDate: string;
  visitedDateKeys?: string[];
}

const DEFAULT_STREAK_SNAPSHOT: StudyStreakSnapshot = {
  current: 0,
  best: 0,
  lastVisitDate: '',
  visitedDateKeys: [],
};

/**
 * Monta a chave de armazenamento isolada por usuario autenticado.
 * Assim cada conta mantem sua propria sequencia no navegador atual.
 *
 * @since 1.0.0
 */
const buildStudyStreakStorageKey = (userId: string): string => `cm-study-streak:${userId}`;

/**
 * Normaliza a data no formato YYYY-MM-DD para comparar visitas diarias.
 * O contador da sequencia depende desse valor para saber se houve quebra.
 *
 * @since 1.0.0
 */
const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calcula a diferenca de dias entre duas chaves normalizadas.
 * Esse comparativo define se a sequencia continua, repete ou zera.
 *
 * @since 1.0.0
 */
const diffDaysBetweenKeys = (currentDateKey: string, previousDateKey: string): number => {
  if (!currentDateKey || !previousDateKey) {
    return Number.POSITIVE_INFINITY;
  }

  const currentDate = new Date(`${currentDateKey}T00:00:00`);
  const previousDate = new Date(`${previousDateKey}T00:00:00`);
  return Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);
};

/**
 * Le o snapshot atual da sequencia salvo localmente.
 * Quando nao existir nada persistido, devolve a estrutura inicial.
 *
 * @since 1.0.0
 */
export const getStudyStreakSnapshot = (userId: string): StudyStreakSnapshot => {
  if (typeof window === 'undefined') {
    return DEFAULT_STREAK_SNAPSHOT;
  }

  try {
    const rawValue = window.localStorage.getItem(buildStudyStreakStorageKey(userId));
    if (!rawValue) {
      return DEFAULT_STREAK_SNAPSHOT;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StudyStreakSnapshot>;
    return {
      current: Math.max(0, Number(parsedValue.current || 0)),
      best: Math.max(0, Number(parsedValue.best || 0)),
      lastVisitDate: String(parsedValue.lastVisitDate || ''),
      visitedDateKeys: Array.from(new Set([
        ...(Array.isArray(parsedValue.visitedDateKeys) ? parsedValue.visitedDateKeys : []),
        parsedValue.lastVisitDate,
      ].map((item) => String(item || '').trim()).filter(Boolean))).slice(-120),
    };
  } catch {
    return DEFAULT_STREAK_SNAPSHOT;
  }
};

/**
 * Atualiza a sequencia quando o usuario abre a plataforma.
 * A regra mantem o valor se ele voltar no mesmo dia, soma no dia seguinte e zera apos uma falta.
 *
 * @since 1.0.0
 */
export const touchStudyStreak = (userId: string, currentDate: Date = new Date()): StudyStreakSnapshot => {
  if (typeof window === 'undefined') {
    return DEFAULT_STREAK_SNAPSHOT;
  }

  const currentDateKey = toDateKey(currentDate);
  const snapshot = getStudyStreakSnapshot(userId);
  const diffDays = diffDaysBetweenKeys(currentDateKey, snapshot.lastVisitDate);

  if (diffDays === 0) {
    return snapshot;
  }

  const current = diffDays === 1 ? snapshot.current + 1 : 1;
  const visitedDateKeys = Array.from(new Set([
    ...(snapshot.visitedDateKeys || []),
    currentDateKey,
  ])).slice(-120);
  const nextSnapshot = {
    current,
    best: Math.max(snapshot.best, current),
    lastVisitDate: currentDateKey,
    visitedDateKeys,
  };

  window.localStorage.setItem(
    buildStudyStreakStorageKey(userId),
    JSON.stringify(nextSnapshot),
  );

  return nextSnapshot;
};
