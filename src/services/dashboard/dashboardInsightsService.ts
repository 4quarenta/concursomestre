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

import type { Question, UserAnswer } from '@types';

export type DashboardTimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export interface DashboardSubjectMetric {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface DashboardTimelinePoint {
  date: string;
  questions: number;
  correct: number;
  wrong: number;
  timestamp: number;
}

export interface DashboardAccuracySummary {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
}

export interface DashboardLevelProgress {
  currentLevel: number;
  currentXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
}

const XP_PER_LEVEL = 1000;

/**
 * Calcula o inicio do recorte temporal escolhido no dashboard.
 * Ele padroniza o filtro usado pelos graficos e cards da area do usuario.
 *
 * @since 1.0.0
 */
export const getRangeStartTimestamp = (timeRange: DashboardTimeRange, now: Date = new Date()): number => {
  switch (timeRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).getTime();
    case 'all':
    default:
      return 0;
  }
};

/**
 * Filtra as respostas do usuario pelo periodo selecionado.
 * Esse recorte alimenta todos os componentes de desempenho do dashboard.
 *
 * @since 1.0.0
 */
export const filterAnswersByRange = (
  answers: UserAnswer[],
  timeRange: DashboardTimeRange,
  now: Date = new Date(),
): UserAnswer[] => {
  const startTimestamp = getRangeStartTimestamp(timeRange, now);
  if (timeRange === 'all') {
    return answers;
  }

  return answers.filter((answer) => Number(answer.timestamp) >= startTimestamp);
};

/**
 * Resolve o nome principal da materia de uma questao.
 * Ele aceita formatos legados e atuais para evitar cards vazios no dashboard.
 *
 * @since 1.0.0
 */
export const getQuestionPrimarySubject = (question: Question | undefined | null): string => {
  const subjectEntry = Array.isArray(question?.assuntos)
    ? question.assuntos.find((item: any) => Boolean(item?.materia)) || question.assuntos[0]
    : null;

  const rawName = subjectEntry && typeof subjectEntry === 'object'
    ? subjectEntry.nome || subjectEntry.name || subjectEntry.nome_clean || subjectEntry.slug
    : subjectEntry;

  return String(rawName || 'Geral').trim() || 'Geral';
};

/**
 * Consolida acertos, erros e precisao por materia.
 * A saida e usada tanto no card resumido quanto na pagina "ver mais".
 *
 * @since 1.0.0
 */
export const buildSubjectPerformanceData = (
  answers: UserAnswer[],
  questions: Question[],
): DashboardSubjectMetric[] => {
  const questionMap = new Map<string, Question>();
  questions.forEach((question) => {
    if (question?.id !== undefined && question?.id !== null) {
      questionMap.set(String(question.id), question);
    }
  });

  const metrics = new Map<string, DashboardSubjectMetric>();

  answers.forEach((answer) => {
    const subjectName = getQuestionPrimarySubject(questionMap.get(String(answer.questionId)));
    const existingMetric = metrics.get(subjectName) || {
      name: subjectName,
      total: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
    };

    existingMetric.total += 1;
    existingMetric.correct += answer.isCorrect ? 1 : 0;
    existingMetric.wrong += answer.isCorrect ? 0 : 1;
    existingMetric.accuracy = existingMetric.total > 0
      ? Math.round((existingMetric.correct / existingMetric.total) * 100)
      : 0;

    metrics.set(subjectName, existingMetric);
  });

  return Array.from(metrics.values()).sort((left, right) => right.total - left.total);
};

/**
 * Resume os indicadores gerais de acerto do usuario no periodo filtrado.
 * Ele abastece o donut central e o rodape com acertos e erros.
 *
 * @since 1.0.0
 */
export const calculateAccuracySummary = (answers: UserAnswer[]): DashboardAccuracySummary => {
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const accuracyRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    accuracyRate,
  };
};

/**
 * Monta os pontos do grafico temporal por quantidade de questoes.
 * A serie troca a antiga leitura de progresso por atividade real de respostas.
 *
 * @since 1.0.0
 */
export const buildQuestionTimelineData = (
  answers: UserAnswer[],
  timeRange: DashboardTimeRange,
  now: Date = new Date(),
): DashboardTimelinePoint[] => {
  const points: DashboardTimelinePoint[] = [];
  let steps = 7;
  let format: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

  if (timeRange === 'today') {
    steps = now.getHours() + 1;
    format = { hour: '2-digit', minute: '2-digit' };
  } else if (timeRange === 'month') {
    steps = 30;
  } else if (timeRange === 'year') {
    steps = 12;
    format = { month: 'short' };
  }

  for (let index = steps - 1; index >= 0; index -= 1) {
    const pointDate = new Date(now);
    if (timeRange === 'today') {
      pointDate.setHours(pointDate.getHours() - index, 0, 0, 0);
    } else if (timeRange === 'year') {
      pointDate.setMonth(pointDate.getMonth() - index, 1);
      pointDate.setHours(0, 0, 0, 0);
    } else {
      pointDate.setDate(pointDate.getDate() - index);
      pointDate.setHours(0, 0, 0, 0);
    }

    points.push({
      date: timeRange === 'today'
        ? `${pointDate.getHours().toString().padStart(2, '0')}:00`
        : pointDate.toLocaleDateString('pt-BR', format),
      questions: 0,
      correct: 0,
      wrong: 0,
      timestamp: pointDate.getTime(),
    });
  }

  const pointMap = new Map<string, DashboardTimelinePoint>();
  points.forEach((point) => pointMap.set(point.date, point));

  answers.forEach((answer) => {
    const answerDate = new Date(answer.timestamp);
    const pointKey = timeRange === 'today'
      ? `${answerDate.getHours().toString().padStart(2, '0')}:00`
      : answerDate.toLocaleDateString('pt-BR', format);

    const point = pointMap.get(pointKey);
    if (!point) {
      return;
    }

    point.questions += 1;
    point.correct += answer.isCorrect ? 1 : 0;
    point.wrong += answer.isCorrect ? 0 : 1;
  });

  return points;
};

/**
 * Calcula o progresso do nivel atual com base no XP acumulado.
 * O dashboard usa esse resumo para mostrar o quanto falta ate o proximo nivel.
 *
 * @since 1.0.0
 */
export const calculateLevelProgress = (xp: number | undefined, level: number | undefined): DashboardLevelProgress => {
  const currentXp = Math.max(0, Number(xp || 0));
  const currentLevel = Math.max(1, Number(level || 1));
  const xpIntoLevel = currentXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  const levelProgressPercent = Math.max(0, Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)));

  return {
    currentLevel,
    currentXp,
    xpIntoLevel,
    xpToNextLevel,
    levelProgressPercent,
  };
};

/**
 * Remove marcadores markdown e linhas vazias da base de motivacoes.
 * Assim o admin pode subir listas simples sem quebrar a selecao diaria.
 *
 * @since 1.0.0
 */
export const parseDailyMotivationMarkdown = (markdown: string): string[] => {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('<!--') && !line.startsWith('#'))
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+[.)-]?\s+/, '').trim())
    .filter(Boolean);
};

/**
 * Calcula o dia do ano da data atual.
 * Esse indice garante que a mesma frase seja mantida ao longo do dia inteiro.
 *
 * @since 1.0.0
 */
export const getDayOfYear = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.floor(diff / 86400000);
};

/**
 * Seleciona a frase motivacional do dia com base no markdown salvo.
 * Quando a base estiver vazia, o dashboard usa uma mensagem segura de fallback.
 *
 * @since 1.0.0
 */
export const getDailyMotivationForDate = (markdown: string, date: Date = new Date()): string => {
  const motivations = parseDailyMotivationMarkdown(markdown);
  if (motivations.length === 0) {
    return 'Seu foco de hoje construi a aprovacao de amanha.';
  }

  const dayIndex = (getDayOfYear(date) - 1) % motivations.length;
  return motivations[dayIndex] || motivations[0];
};

/**
 * Formata a data do dashboard no padrao amigavel em pt-BR.
 * O card de motivacao usa esse texto para reforcar o contexto do dia.
 *
 * @since 1.0.0
 */
export const formatDashboardDate = (date: Date = new Date()): string => {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};
