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
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

/**
 * Dashboard mobile com estatisticas reais do usuario.
 * @since v1.0.0
 */
export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const { user } = useAuth();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const subjectTop5 = React.useMemo(() => stats.subjectBreakdown.slice(0, 5), [stats.subjectBreakdown]);

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

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Questoes</Text>
          <Text style={styles.kpiValue}>{stats.totalQuestionsAnswered}</Text>
          <Text style={styles.kpiHint}>Respondidas</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Acuracia</Text>
          <Text style={styles.kpiValue}>{Math.round(clampPercent(stats.accuracyRate))}%</Text>
          <Text style={styles.kpiHint}>
            {stats.correctAnswers} acertos
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
        <Text style={styles.sectionTitle}>Desempenho por materia</Text>
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
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
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
