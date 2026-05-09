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
import type { SubjectStatistics } from '@services/statistics/types';

export type DashboardTimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export interface DashboardSubjectMetric {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface DashboardSubjectPeerMetric {
  name: string;
  total: number;
  correct: number;
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

export interface DashboardPerformanceInsight {
  tone: 'emerald' | 'amber' | 'rose' | 'indigo';
  title: string;
  description: string;
}

export interface DashboardLevelProgress {
  currentLevel: number;
  currentXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
}

const XP_PER_LEVEL = 1000;

const normalizeMetricCount = (value: unknown): number => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
};

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
 * Converte o breakdown oficial de estatisticas por materia para o formato do dashboard.
 * Isso evita baixar o banco inteiro de questoes apenas para renderizar o resumo da home logada.
 *
 * @since 1.0.0
 */
export const buildSubjectPerformanceDataFromStatistics = (
  subjectBreakdown: SubjectStatistics[] | null | undefined,
): DashboardSubjectMetric[] => {
  if (!Array.isArray(subjectBreakdown)) {
    return [];
  }

  return subjectBreakdown
    .map((subject) => ({
      name: String(subject.subject || 'Geral').trim() || 'Geral',
      total: normalizeMetricCount(subject.totalQuestions),
      correct: normalizeMetricCount(subject.correctAnswers),
      wrong: normalizeMetricCount(subject.wrongAnswers),
      accuracy: normalizeMetricCount(subject.accuracyRate),
    }))
    .filter((subject) => subject.total > 0)
    .sort((left, right) => right.total - left.total);
};

/**
 * Consolida a media geral da plataforma por materia e desconta o usuario atual quando possivel.
 * O resultado permite comparar o desempenho individual com os demais usuarios.
 *
 * @since 1.0.0
 */
export const buildSubjectPeerComparisonData = (
  questions: Question[],
  userSubjectMetrics: DashboardSubjectMetric[] = [],
): Map<string, DashboardSubjectPeerMetric> => {
  const userMetricsBySubject = new Map<string, DashboardSubjectMetric>();
  userSubjectMetrics.forEach((metric) => userMetricsBySubject.set(metric.name, metric));

  const aggregatedMetrics = new Map<string, DashboardSubjectPeerMetric>();

  questions.forEach((question) => {
    const totalAttempts = normalizeMetricCount(question.stats?.totalAttempts);
    const correctCount = Math.min(totalAttempts, normalizeMetricCount(question.stats?.correctCount));

    if (totalAttempts <= 0) {
      return;
    }

    const subjectName = getQuestionPrimarySubject(question);
    const metric = aggregatedMetrics.get(subjectName) || {
      name: subjectName,
      total: 0,
      correct: 0,
      accuracy: 0,
    };

    metric.total += totalAttempts;
    metric.correct += correctCount;
    aggregatedMetrics.set(subjectName, metric);
  });

  const peerMetrics = new Map<string, DashboardSubjectPeerMetric>();

  aggregatedMetrics.forEach((metric, subjectName) => {
    const userMetric = userMetricsBySubject.get(subjectName);
    const peerTotal = Math.max(0, metric.total - normalizeMetricCount(userMetric?.total));
    const peerCorrect = Math.max(0, Math.min(peerTotal, metric.correct - normalizeMetricCount(userMetric?.correct)));
    const accuracy = peerTotal > 0 ? Math.round((peerCorrect / peerTotal) * 100) : 0;

    peerMetrics.set(subjectName, {
      name: subjectName,
      total: peerTotal,
      correct: peerCorrect,
      accuracy,
    });
  });

  return peerMetrics;
};

/**
 * Gera uma leitura curta para cada materia combinando desempenho proprio e comparativo.
 * A pagina detalhada usa esse texto como insight por materia para usuarios Elite.
 *
 * @since 1.0.0
 */
export const buildSubjectPerformanceInsight = (
  subject: DashboardSubjectMetric,
  peerMetric?: DashboardSubjectPeerMetric | null,
): DashboardPerformanceInsight => {
  const hasPeerData = Boolean(peerMetric && peerMetric.total > 0);
  const peerAccuracy = peerMetric?.accuracy || 0;
  const delta = hasPeerData ? subject.accuracy - peerAccuracy : 0;

  if (subject.total < 5) {
    return {
      tone: 'indigo',
      title: 'Base pequena',
      description: `Voce ja tem um sinal inicial em ${subject.name}, mas resolva mais questoes antes de cravar uma tendencia.`,
    };
  }

  if (hasPeerData && delta >= 12) {
    return {
      tone: 'emerald',
      title: 'Acima da media',
      description: `Seu acerto esta ${delta} p.p. acima dos outros usuarios. Mantenha revisoes leves para conservar essa vantagem.`,
    };
  }

  if (subject.accuracy >= 80) {
    return {
      tone: 'emerald',
      title: 'Ponto forte',
      description: `A materia esta bem dominada. Use ${subject.name} para ganhar velocidade e atacar questoes mais dificeis.`,
    };
  }

  if (hasPeerData && delta <= -12) {
    return {
      tone: 'rose',
      title: 'Abaixo da media',
      description: `Os outros usuarios estao em ${peerAccuracy}% e voce em ${subject.accuracy}%. Vale revisar a base antes de aumentar volume.`,
    };
  }

  if (subject.accuracy >= 60) {
    return {
      tone: 'amber',
      title: 'Faixa de consolidacao',
      description: `Ha bom caminho em ${subject.name}, mas os erros ainda mostram pontos soltos. Reforce os assuntos com maior recorrencia.`,
    };
  }

  return {
    tone: 'rose',
    title: 'Prioridade de revisao',
    description: `O aproveitamento em ${subject.name} ainda esta baixo. Comece por comentarios, lei seca/resumos e poucas questoes bem corrigidas.`,
  };
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
 * Gera um insight curto para o card de desempenho geral.
 * O texto muda conforme a porcentagem de acerto e tenta orientar o proximo passo.
 *
 * @since 1.0.0
 */
export const buildAccuracyInsight = (
  summary: DashboardAccuracySummary,
): DashboardPerformanceInsight => {
  if (summary.totalQuestions === 0) {
    return {
      tone: 'indigo',
      title: 'Base em construcao',
      description: 'Resolva algumas questoes para liberar um diagnostico real do seu desempenho.',
    };
  }

  if (summary.accuracyRate >= 85) {
    return {
      tone: 'emerald',
      title: 'Desempenho muito forte',
      description: 'Seu aproveitamento esta alto. Vale manter ritmo e priorizar revisoes para nao perder consistencia.',
    };
  }

  if (summary.accuracyRate >= 70) {
    return {
      tone: 'emerald',
      title: 'Bom nivel de precisao',
      description: 'Voce ja esta em uma faixa competitiva. O melhor ganho agora costuma vir dos erros recorrentes.',
    };
  }

  if (summary.accuracyRate >= 55) {
    return {
      tone: 'amber',
      title: 'Faixa de consolidacao',
      description: 'O desempenho esta intermediario. Revisar fundamentos e atacar os temas com mais erro tende a destravar rapido.',
    };
  }

  if (summary.accuracyRate >= 40) {
    return {
      tone: 'amber',
      title: 'Atencao aos fundamentos',
      description: 'Sua margem de erro ainda esta alta. O melhor caminho agora e revisar base teorica antes de ganhar velocidade.',
    };
  }

  return {
    tone: 'rose',
    title: 'Hora de recalibrar',
    description: 'Seu percentual indica dificuldade forte no recorte atual. Foque em materia, assunto e comentarios antes de ampliar volume.',
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
