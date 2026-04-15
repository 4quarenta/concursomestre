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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { statisticsService } from '@/services/statistics/statisticsService';
import { colors } from '@/theme/colors';
import type { SubjectStatistics, UserStatistics } from '@/types/statistics';

type PerformanceSubjectsNavigation = NativeStackNavigationProp<AppStackParamList, 'PerformanceSubjects'>;

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

const getReadingLabel = (accuracy: number) => {
  if (accuracy >= 75) return 'Muito bem';
  if (accuracy >= 50) return 'Atencao';
  return 'Revisar';
};

/**
 * Tela detalhada de desempenho por materia no app mobile.
 * Ela expande o resumo do dashboard usando o mesmo payload consolidado de estatisticas do usuario.
 * @since v1.0.0
 */
export const PerformanceSubjectsScreen: React.FC = () => {
  const navigation = useNavigation<PerformanceSubjectsNavigation>();
  const { user } = useAuth();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const subjectRows = React.useMemo(() => (
    [...stats.subjectBreakdown].sort((a, b) => (
      b.totalQuestions - a.totalQuestions || b.accuracyRate - a.accuracyRate
    ))
  ), [stats.subjectBreakdown]);

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
      setError(loadError?.message || 'Nao foi possivel carregar as materias agora.');
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
    const readingLabel = getReadingLabel(accuracy);

    return (
      <View key={`${item.subject}-${item.totalQuestions}`} style={styles.subjectCard}>
        <View style={styles.subjectHeader}>
          <View style={styles.subjectTitleBlock}>
            <Text numberOfLines={2} style={styles.subjectTitle}>{item.subject}</Text>
            <Text style={styles.subjectSubtitle}>{item.totalQuestions} questoes respondidas</Text>
          </View>
          <View style={styles.accuracyPill}>
            <Text style={styles.accuracyValue}>{Math.round(accuracy)}%</Text>
            <Text style={styles.accuracyLabel}>precisao</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${accuracy}%` }]} />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Acertos</Text>
            <Text style={[styles.metricValue, styles.correctText]}>{item.correctAnswers}</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Erros</Text>
            <Text style={[styles.metricValue, styles.wrongText]}>{item.wrongAnswers}</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Leitura</Text>
            <Text style={styles.metricValue}>{readingLabel}</Text>
          </View>
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
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Voltar ao dashboard</Text>
      </Pressable>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Performance detalhada</Text>
        <Text style={styles.heroTitle}>Todos os dados por materia</Text>
        <Text style={styles.heroText}>
          Veja onde voce esta forte, onde esta errando mais e quais materias pedem revisao.
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Materias</Text>
          <Text style={styles.summaryValue}>{subjectRows.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Questoes</Text>
          <Text style={styles.summaryValue}>{stats.totalQuestionsAnswered}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Precisao</Text>
          <Text style={styles.summaryValue}>{Math.round(clampPercent(stats.accuracyRate))}%</Text>
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Tabela completa</Text>
        <Text style={styles.sectionText}>Resultados consolidados por materia.</Text>
        {subjectRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma materia consolidada ainda</Text>
            <Text style={styles.emptyText}>Resolva questoes para preencher esta analise detalhada.</Text>
          </View>
        ) : (
          <View style={styles.subjectList}>
            {subjectRows.map((row) => renderSubjectRow(row))}
          </View>
        )}
      </View>
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
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 6,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 2,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  subjectList: {
    gap: 10,
  },
  subjectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 10,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  subjectTitleBlock: {
    flex: 1,
    gap: 4,
  },
  subjectTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  subjectSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  accuracyPill: {
    minWidth: 70,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  accuracyValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  accuracyLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 3,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  metricValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  correctText: {
    color: colors.success,
  },
  wrongText: {
    color: colors.danger,
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
    letterSpacing: 0,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PerformanceSubjectsScreen;
