import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList, MainTabParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { formatStudyDuration } from '@/services/statistics/studyTimeFormatting';
import { statisticsService } from '@/services/statistics/statisticsService';
import { colors } from '@/theme/colors';
import type { SubjectStatistics, UserStatistics } from '@/types/statistics';

type DashboardTimeRange = 'today' | 'week' | 'month' | 'all';
const TIME_RANGE_LABELS: Record<DashboardTimeRange, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mes',
  all: 'Tudo',
};

type DashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<AppStackParamList>
>;

const EMPTY_STATS: UserStatistics = {
  userId: '',
  totalQuestionsAnswered: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  accuracyRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  questionStudyTime: 0,
  readingStudyTime: 0,
  totalStudyTime: 0,
  lastActivity: '',
  subjectBreakdown: [],
  timeline: [],
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const XP_PER_LEVEL = 1000;

const DAILY_MOTIVATIONS: string[] = [
  'Seu foco de hoje constroi a aprovacao de amanha.',
  'Cada questao resolvida reduz a distancia ate sua vaga.',
  'Consistencia vence intensidade quando o projeto e longo.',
  'Revise com calma: clareza vale mais que velocidade.',
  'Pequenos blocos de estudo tambem mudam seu resultado final.',
  'Disciplina diaria transforma inseguranca em preparo real.',
  'Nao espere perfeicao para continuar: avance com metodo.',
  'Erros de hoje viram acertos de prova quando voce revisa.',
  'Seu ritmo importa mais que comparacoes com outras pessoas.',
  'O proximo acerto comeca no proximo minuto de estudo.',
];

const getDayOfYear = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.floor(diff / 86400000);
};

const getDailyMotivation = (date: Date): string => {
  const dayIndex = (getDayOfYear(date) - 1) % DAILY_MOTIVATIONS.length;
  return DAILY_MOTIVATIONS[dayIndex] || DAILY_MOTIVATIONS[0];
};

const formatDashboardDate = (date: Date): string => (
  date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
);

const formatTimelineLabel = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '--';
  if (normalized.includes(':')) {
    const hour = normalized.slice(0, 2);
    return `${hour}h`;
  }
  return normalized.length <= 5 ? normalized : normalized.slice(0, 5);
};

const getRangeStartTimestamp = (range: DashboardTimeRange, now: Date): number => {
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  if (range === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }

  if (range === 'month') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }

  return 0;
};

const calculateLevelProgress = (xp: number | undefined, level: number | undefined) => {
  const currentXp = Math.max(0, Number(xp || 0));
  const currentLevel = Math.max(1, Number(level || 1));
  const xpIntoLevel = currentXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  const levelProgressPercent = clampPercent(Math.round((xpIntoLevel / XP_PER_LEVEL) * 100));

  return {
    currentLevel,
    currentXp,
    xpIntoLevel,
    xpToNextLevel,
    levelProgressPercent,
  };
};

/**
 * Dashboard mobile com estatisticas reais do usuario.
 * @since v1.0.0
 */
export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const { user, isFeatureEnabled } = useAuth();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState<DashboardTimeRange>('all');
  const [showCorrectTimeline, setShowCorrectTimeline] = React.useState(true);

  const subjectTop5 = React.useMemo(() => stats.subjectBreakdown.slice(0, 5), [stats.subjectBreakdown]);
  const today = React.useMemo(() => new Date(), []);
  const timelineRows = React.useMemo(() => {
    const rows = [...stats.timeline];
    if (rows.some((row) => Number(row.timestamp || 0) > 0)) {
      rows.sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0));
    }
    return rows;
  }, [stats.timeline]);
  const filteredTimelineRows = React.useMemo(() => {
    if (timelineRows.length === 0) return [];

    const fallbackCount = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 14;
    const hasTimestamp = timelineRows.some((row) => Number(row.timestamp || 0) > 0);
    if (!hasTimestamp) {
      return timelineRows.slice(-fallbackCount);
    }

    if (timeRange === 'all') {
      return timelineRows.slice(-fallbackCount);
    }

    const start = getRangeStartTimestamp(timeRange, new Date());
    const scopedRows = timelineRows.filter((row) => Number(row.timestamp || 0) >= start);
    return scopedRows.length > 0 ? scopedRows : timelineRows.slice(-fallbackCount);
  }, [timeRange, timelineRows]);
  const timelineMax = React.useMemo(
    () => Math.max(1, ...filteredTimelineRows.map((row) => Number(row.questions || 0))),
    [filteredTimelineRows],
  );
  const timelineSummary = React.useMemo(() => {
    const questions = filteredTimelineRows.reduce((total, row) => total + Number(row.questions || 0), 0);
    const correct = filteredTimelineRows.reduce((total, row) => total + Number(row.correct || 0), 0);
    const wrong = filteredTimelineRows.reduce((total, row) => total + Number(row.wrong || 0), 0);
    const accuracy = questions > 0 ? Math.round((correct / questions) * 100) : 0;

    return {
      questions,
      correct,
      wrong,
      accuracy,
    };
  }, [filteredTimelineRows]);
  const kpiSummary = React.useMemo(() => {
    if (filteredTimelineRows.length === 0) {
      return {
        totalQuestions: Number(stats.totalQuestionsAnswered || 0),
        correctAnswers: Number(stats.correctAnswers || 0),
        wrongAnswers: Number(stats.wrongAnswers || 0),
        accuracyRate: clampPercent(Number(stats.accuracyRate || 0)),
        usingTimeline: false,
      };
    }

    return {
      totalQuestions: timelineSummary.questions,
      correctAnswers: timelineSummary.correct,
      wrongAnswers: timelineSummary.wrong,
      accuracyRate: clampPercent(timelineSummary.accuracy),
      usingTimeline: true,
    };
  }, [
    filteredTimelineRows.length,
    stats.accuracyRate,
    stats.correctAnswers,
    stats.totalQuestionsAnswered,
    stats.wrongAnswers,
    timelineSummary.accuracy,
    timelineSummary.correct,
    timelineSummary.questions,
    timelineSummary.wrong,
  ]);
  const dailyMotivation = React.useMemo(() => getDailyMotivation(today), [today]);
  const formattedToday = React.useMemo(() => formatDashboardDate(today), [today]);
  const levelProgress = React.useMemo(
    () => calculateLevelProgress(user?.xp, user?.level),
    [user?.level, user?.xp],
  );
  const canAccessAnnotatedLaws = isFeatureEnabled('annotatedLawsEnabled');
  const canAccessFlashcards = isFeatureEnabled('flashcardsEnabled');

  const loadStats = React.useCallback(async (useRefresh = false) => {
    if (!user?.id) {
      setStats(EMPTY_STATS);
      setError(null);
      setLoading(false);
      return;
    }

    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const payload = await statisticsService.getUserStatistics(user.id);
      setStats(payload);
      setError(null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Nao foi possivel carregar o dashboard agora.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      void loadStats(false);
    }, [loadStats]),
  );

  const renderSubjectRow = (item: SubjectStatistics) => {
    const accuracy = clampPercent(item.accuracyRate);

    return (
      <View key={`${item.subject}-${item.totalQuestions}`} style={styles.subjectRow}>
        <View style={styles.subjectRowHeader}>
          <Text numberOfLines={1} style={styles.subjectName}>
            {item.subject}
          </Text>
          <Text style={styles.subjectMeta}>
            {Math.round(accuracy)}% - {item.correctAnswers}/{item.totalQuestions}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${accuracy}%` }]} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadStats(true)}
          tintColor={colors.primary}
        />
      )}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Seu progresso</Text>
        <Text style={styles.heroTitle}>Ola, {user?.name || 'Aluno'}</Text>
        <Text style={styles.heroText}>
          Este painel usa dados reais de estudo para voce ajustar ritmo, revisao e foco.
        </Text>
      </View>

      <View style={styles.motivationCard}>
        <View style={styles.motivationHeader}>
          <Text style={styles.motivationEyebrow}>Motivacao diaria</Text>
          <Text style={styles.motivationDate}>{formattedToday}</Text>
        </View>
        <Text style={styles.motivationQuote}>"{dailyMotivation}"</Text>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Questoes</Text>
          <Text style={styles.kpiValue}>{kpiSummary.totalQuestions}</Text>
          <Text style={styles.kpiHint}>
            {kpiSummary.usingTimeline ? `Respondidas (${TIME_RANGE_LABELS[timeRange]})` : 'Respondidas'}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Acuracia</Text>
          <Text style={styles.kpiValue}>{Math.round(kpiSummary.accuracyRate)}%</Text>
          <Text style={styles.kpiHint}>
            {kpiSummary.correctAnswers} acertos / {kpiSummary.wrongAnswers} erros
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Sequencia</Text>
          <Text style={styles.kpiValue}>{stats.currentStreak}</Text>
          <Text style={styles.kpiHint}>dias ativos</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Melhor streak</Text>
          <Text style={styles.kpiValue}>{stats.bestStreak}</Text>
          <Text style={styles.kpiHint}>recorde pessoal</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.levelHeaderRow}>
          <Text style={styles.sectionTitle}>Nivel do usuario</Text>
          <Text style={styles.levelBadge}>Nivel {levelProgress.currentLevel}</Text>
        </View>
        <View style={styles.levelMetaRow}>
          <Text style={styles.levelMetaText}>{levelProgress.currentXp} XP acumulados</Text>
          <Text style={styles.levelMetaText}>Faltam {levelProgress.xpToNextLevel} XP</Text>
        </View>
        <View style={styles.levelTrack}>
          <View style={[styles.levelFill, { width: `${levelProgress.levelProgressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tempo de estudo</Text>
        <View style={styles.studyRow}>
          <Text style={styles.studyLabel}>Total</Text>
          <Text style={styles.studyValue}>{formatStudyDuration(stats.totalStudyTime)}</Text>
        </View>
        <View style={styles.studyRow}>
          <Text style={styles.studyLabel}>Questoes e simulados</Text>
          <Text style={styles.studyValue}>{formatStudyDuration(stats.questionStudyTime)}</Text>
        </View>
        <View style={styles.studyRow}>
          <Text style={styles.studyLabel}>Leitura</Text>
          <Text style={styles.studyValue}>{formatStudyDuration(stats.readingStudyTime)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Evolucao recente</Text>
          <View style={styles.timelineControls}>
            <Pressable
              onPress={() => setShowCorrectTimeline((current) => !current)}
              style={[styles.timelineToggleButton, showCorrectTimeline && styles.timelineToggleButtonActive]}
            >
              <Text style={[styles.timelineToggleText, showCorrectTimeline && styles.timelineToggleTextActive]}>
                {showCorrectTimeline ? 'Ocultar acertos' : 'Mostrar acertos'}
              </Text>
            </Pressable>
            <View style={styles.rangeRow}>
              {([
                { value: 'today', label: 'Hoje' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'all', label: 'Tudo' },
              ] as Array<{ value: DashboardTimeRange; label: string }>).map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setTimeRange(option.value)}
                  style={[styles.rangeChip, timeRange === option.value && styles.rangeChipActive]}
                >
                  <Text style={[styles.rangeChipText, timeRange === option.value && styles.rangeChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {filteredTimelineRows.length === 0 ? (
          <Text style={styles.emptyText}>
            O timeline da API ainda nao veio preenchido para este usuario.
          </Text>
        ) : (
          <View style={styles.timelineBlock}>
            <View style={styles.timelineLegendRow}>
              <View style={styles.timelineLegendItem}>
                <View style={[styles.timelineLegendDot, styles.timelineLegendDotQuestions]} />
                <Text style={styles.timelineLegendText}>Questoes</Text>
              </View>
              {showCorrectTimeline ? (
                <View style={styles.timelineLegendItem}>
                  <View style={[styles.timelineLegendDot, styles.timelineLegendDotCorrect]} />
                  <Text style={styles.timelineLegendText}>Acertos</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.timelineSummaryRow}>
              <View style={styles.timelineSummaryPill}>
                <Text style={styles.timelineSummaryLabel}>Questoes</Text>
                <Text style={styles.timelineSummaryValue}>{timelineSummary.questions}</Text>
              </View>
              <View style={styles.timelineSummaryPill}>
                <Text style={styles.timelineSummaryLabel}>Acertos</Text>
                <Text style={styles.timelineSummaryValue}>{timelineSummary.correct}</Text>
              </View>
              <View style={styles.timelineSummaryPill}>
                <Text style={styles.timelineSummaryLabel}>Erros</Text>
                <Text style={styles.timelineSummaryValue}>{timelineSummary.wrong}</Text>
              </View>
              <View style={styles.timelineSummaryPill}>
                <Text style={styles.timelineSummaryLabel}>Precisao</Text>
                <Text style={styles.timelineSummaryValue}>{timelineSummary.accuracy}%</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineChartContent}
            >
              {filteredTimelineRows.map((row, index) => {
                const questionsPercent = clampPercent((Number(row.questions || 0) / timelineMax) * 100);
                const correctPercent = clampPercent((Number(row.correct || 0) / timelineMax) * 100);
                return (
                  <View key={`chart-${row.label}-${index}`} style={styles.timelineChartColumn}>
                    <View style={styles.timelineChartTrack}>
                      <View style={[styles.timelineChartQuestionsBar, { height: `${questionsPercent}%` }]} />
                      {showCorrectTimeline ? (
                        <View style={[styles.timelineChartCorrectBar, { height: `${correctPercent}%` }]} />
                      ) : null}
                    </View>
                    <Text style={styles.timelineChartLabel}>{formatTimelineLabel(row.label)}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.timelineList}>
              {filteredTimelineRows.map((row, index) => {
                const questionsPercent = clampPercent((Number(row.questions || 0) / timelineMax) * 100);
                const correctPercent = clampPercent((Number(row.correct || 0) / timelineMax) * 100);
                return (
                  <View key={`${row.label}-${index}`} style={styles.timelineRow}>
                    <Text style={styles.timelineLabel}>{row.label}</Text>
                    <View style={styles.timelineTrack}>
                      <View style={[styles.timelineFill, { width: `${questionsPercent}%` }]} />
                      {showCorrectTimeline ? (
                        <View style={[styles.timelineCorrectFill, { width: `${correctPercent}%` }]} />
                      ) : null}
                    </View>
                    <Text style={styles.timelineValue}>
                      {showCorrectTimeline ? `${row.correct}/${row.questions}` : row.questions}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Desempenho por materia</Text>
          {subjectTop5.length > 0 ? (
            <Pressable style={styles.linkButton} onPress={() => navigation.navigate('PerformanceSubjects')}>
              <Text style={styles.linkButtonText}>Ver todas</Text>
            </Pressable>
          ) : null}
        </View>
        {subjectTop5.length === 0 ? (
          <Text style={styles.emptyText}>
            Sem dados por materia ainda. Continue praticando para preencher este bloco.
          </Text>
        ) : (
          <View style={styles.subjectList}>
            {subjectTop5.map((row) => renderSubjectRow(row))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Atalhos</Text>
        <View style={styles.quickActions}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Questoes')}>
            <Text style={styles.actionButtonText}>Praticar questoes</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Simulados')}>
            <Text style={styles.actionButtonText}>Iniciar simulado</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Planos')}>
            <Text style={styles.actionButtonText}>Ver planos</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.actionButtonText}>Notificacoes</Text>
          </Pressable>
          {canAccessAnnotatedLaws ? (
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('AnnotatedLaws')}>
              <Text style={styles.actionButtonText}>Lei comentada</Text>
            </Pressable>
          ) : null}
          {canAccessFlashcards ? (
            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Flashcards')}>
              <Text style={styles.actionButtonText}>Flashcards</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadStats(true)}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 5,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  motivationCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 8,
  },
  motivationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  motivationEyebrow: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  motivationDate: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  motivationQuote: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: 12,
    width: '48.9%',
    gap: 2,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kpiValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  kpiHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  levelBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  levelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelMetaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  levelTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineControls: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timelineToggleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timelineToggleButtonActive: {
    borderColor: '#99F6E4',
    backgroundColor: '#CCFBF1',
  },
  timelineToggleText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  timelineToggleTextActive: {
    color: '#0F766E',
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  rangeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  rangeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  rangeChipText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  rangeChipTextActive: {
    color: colors.primary,
  },
  linkButton: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studyLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  studyValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  subjectList: {
    gap: 8,
  },
  timelineBlock: {
    gap: 10,
  },
  timelineChartContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  timelineChartColumn: {
    width: 28,
    gap: 6,
    alignItems: 'center',
  },
  timelineChartTrack: {
    width: '100%',
    height: 84,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  timelineChartQuestionsBar: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  timelineChartCorrectBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: '#0F766E',
  },
  timelineChartLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  timelineLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  timelineLegendDotQuestions: {
    backgroundColor: colors.primary,
  },
  timelineLegendDotCorrect: {
    backgroundColor: '#0F766E',
  },
  timelineLegendText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  timelineSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineSummaryPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    minWidth: 78,
  },
  timelineSummaryLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  timelineSummaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  timelineList: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineLabel: {
    minWidth: 56,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  timelineTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  timelineFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  timelineCorrectFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: '#0F766E',
  },
  timelineValue: {
    minWidth: 46,
    textAlign: 'right',
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  subjectRow: {
    gap: 6,
  },
  subjectRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  subjectMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  quickActions: {
    gap: 8,
  },
  actionButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  retryButton: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default DashboardScreen;
