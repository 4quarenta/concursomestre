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

import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { AppButton, AppLink, AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { StandardSectionHeader } from "@/components/layout/StandardSectionHeader";
import { useAuth } from "@/providers/AuthProvider";
import { statisticsService } from "@/services/statistics/statisticsService";
import { readApiErrorMessage } from "@/services/api/response";
import { borders, darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { StatisticsTimelinePoint, SubjectStatistics, UserStatistics } from "@/types/statistics";

type Period = "dia" | "semanal" | "mensal" | "tudo";

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "dia", label: "Dia" },
  { value: "semanal", label: "Semana" },
  { value: "mensal", label: "Mês" },
  { value: "tudo", label: "Tudo" },
];

const EMPTY_STATS: UserStatistics = {
  userId: "",
  totalQuestionsAnswered: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  accuracyRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  questionStudyTime: 0,
  readingStudyTime: 0,
  totalStudyTime: 0,
  lastActivity: "",
  subjectBreakdown: [],
  timeline: [],
};

const clamp = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const aggregatePeriodSubjects = (points: StatisticsTimelinePoint[]): SubjectStatistics[] => {
  const metrics = new Map<string, SubjectStatistics>();
  points.forEach((point) => {
    point.subjectBreakdown?.forEach((subject) => {
      const current = metrics.get(subject.subject) || {
        subject: subject.subject,
        totalQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        accuracyRate: 0,
      };
      current.totalQuestions += subject.totalQuestions;
      current.correctAnswers += subject.correctAnswers;
      current.wrongAnswers += subject.wrongAnswers;
      current.accuracyRate = current.totalQuestions > 0
        ? (current.correctAnswers / current.totalQuestions) * 100
        : 0;
      metrics.set(subject.subject, current);
    });
  });
  return Array.from(metrics.values())
    .sort((left, right) => right.totalQuestions - left.totalQuestions);
};

export const PerformanceScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [timeline, setTimeline] = React.useState<StatisticsTimelinePoint[]>([]);
  const [period, setPeriod] = React.useState<Period>("semanal");
  const [screenFocused, setScreenFocused] = React.useState(false);
  const [chartLoading, setChartLoading] = React.useState(true);
  const [chartError, setChartError] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const timelineRequestId = React.useRef(0);

  const loadSummary = React.useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        setStats(EMPTY_STATS);
        setErrorMessage("");
        if (refresh) setRefreshing(false);
        return;
      }
      if (refresh) setRefreshing(true);
      setErrorMessage("");
      try {
        const [statisticsResult, answerSnapshotResult] = await Promise.allSettled([
          statisticsService.getUserStatistics(user.id),
          statisticsService.getCurrentUserAnswerSnapshot(),
        ]);
        let hasSummary = false;
        if (statisticsResult.status === 'fulfilled') {
          setStats(statisticsResult.value);
          hasSummary = true;
        }
        if (answerSnapshotResult.status === 'fulfilled') {
          setStats((current) => ({
            ...current,
            ...answerSnapshotResult.value.summary,
            subjectBreakdown: current.subjectBreakdown.length > 0
              ? current.subjectBreakdown
              : answerSnapshotResult.value.subjectBreakdown,
          }));
          hasSummary = true;
        }
        if (!hasSummary) {
          const failure = statisticsResult.status === 'rejected'
            ? statisticsResult.reason
            : answerSnapshotResult.status === 'rejected'
              ? answerSnapshotResult.reason
              : undefined;
          setErrorMessage(readApiErrorMessage(
            failure,
            "Não foi possível carregar seu desempenho agora.",
          ));
        }
      } catch (error) {
        // A indisponibilidade das estatisticas nao pode derrubar toda a arvore
        // de navegacao. Mantemos o ultimo resumo seguro e oferecemos retry.
        setErrorMessage(
          readApiErrorMessage(
            error,
            "Não foi possível carregar seu desempenho agora.",
          ),
        );
      } finally {
        if (refresh) setRefreshing(false);
      }
    },
    [user?.id],
  );

  useFocusEffect(React.useCallback(() => {
    setScreenFocused(true);
    void loadSummary();
    return () => {
      setScreenFocused(false);
      timelineRequestId.current += 1;
    };
  }, [loadSummary]));

  const loadTimeline = React.useCallback(async (selectedPeriod: Period) => {
    const requestId = ++timelineRequestId.current;
    if (!user?.id || selectedPeriod === "tudo") {
      setTimeline([]);
      setChartError("");
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    setChartError("");
    try {
      const result = await statisticsService.getCurrentUserQuestionTimeline(selectedPeriod);
      if (timelineRequestId.current === requestId) setTimeline(result);
    } catch (error) {
      if (timelineRequestId.current === requestId) {
        setChartError(readApiErrorMessage(
          error,
          "Não foi possível carregar sua atividade agora.",
        ));
      }
    } finally {
      if (timelineRequestId.current === requestId) setChartLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (!screenFocused || isVisitor) return undefined;
    void loadTimeline(period);
    return () => { timelineRequestId.current += 1; };
  }, [isVisitor, loadTimeline, period, screenFocused]);

  const refresh = React.useCallback(() => {
    void Promise.all([loadSummary(true), loadTimeline(period)]);
  }, [loadSummary, loadTimeline, period]);

  const periodQuestions = period === "tudo"
    ? stats.totalQuestionsAnswered
    : timeline.reduce((total, point) => total + point.questions, 0);
  const periodCorrect = period === "tudo"
    ? stats.correctAnswers
    : timeline.reduce((total, point) => total + point.correct, 0);
  const periodWrong = period === "tudo"
    ? stats.wrongAnswers
    : timeline.reduce((total, point) => total + point.wrong, 0);
  const periodAnswered = periodCorrect + periodWrong;
  const periodAccuracy = periodAnswered > 0
    ? Math.round((periodCorrect / periodAnswered) * 100)
    : 0;
  const periodErrorRate = periodAnswered > 0 ? 100 - periodAccuracy : 0;
  const chartData: StatisticsTimelinePoint[] = period === "tudo"
    ? [{
        label: "Histórico",
        questions: stats.totalQuestionsAnswered,
        correct: stats.correctAnswers,
        wrong: stats.wrongAnswers,
      }]
    : timeline;
  const chartMax = Math.max(1, ...chartData.map((point) => point.questions));
  const chartViewportWidth = Math.max(180, screenWidth - spacing[5] * 4);
  const chartWidth = period === 'mensal'
    ? Math.max(chartViewportWidth, chartData.length * 36)
    : chartViewportWidth;
  const selectedSubjectBreakdown = period === "tudo"
    ? stats.subjectBreakdown
    : aggregatePeriodSubjects(timeline);
  const displayedSubjects = selectedSubjectBreakdown
    .slice()
    .sort((a, b) => b.totalQuestions - a.totalQuestions)
    .slice(0, 8);
  const totalStudyMinutes = Math.floor(Math.max(0, stats.totalStudyTime || 0) / 60);
  const formattedStudyTime = totalStudyMinutes >= 60
    ? `${Math.floor(totalStudyMinutes / 60)}h${totalStudyMinutes % 60 > 0 ? ` ${totalStudyMinutes % 60}min` : ""}`
    : `${totalStudyMinutes}min`;
  const periodLabel = period === "dia"
    ? "Hoje"
    : period === "semanal"
      ? "Esta semana"
      : period === "mensal"
        ? "Últimos 30 dias"
        : "Todo o histórico";
  const chartDescription = period === "dia"
    ? "Questões respondidas por faixa de 3 horas"
    : period === "semanal"
      ? "Questões respondidas por dia"
      : period === "mensal"
        ? "Questões respondidas por dia"
        : "Questões respondidas no histórico";
  const summary = [
    {
      label: "Questões",
      value: periodQuestions.toLocaleString("pt-BR"),
      icon: "book-outline" as const,
    },
    {
      label: "Acerto",
      value: `${periodAccuracy}%`,
      icon: "flag-outline" as const,
    },
    { label: "Tempo total", value: formattedStudyTime, icon: "calendar-outline" as const },
  ];

  if (isVisitor) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
          <StandardSectionHeader
            title="Desempenho"
            subtitle="Acompanhe sua evolução"
          />
          <View style={styles.visitorGate}>
            <AppSurface variant="outlined" style={styles.visitorGateCard}>
              <View style={styles.visitorIcon}>
                <Ionicons name="analytics-outline" size={25} color={theme.primary} />
              </View>
              <AppText variant="sectionTitle" style={styles.visitorTitle}>
                Entre para acompanhar seu desempenho
              </AppText>
              <AppText variant="body" tone="muted" style={styles.visitorDescription}>
                Crie uma conta ou entre para salvar seu progresso, consultar suas estatísticas e acompanhar sua evolução.
              </AppText>
              <AppButton
                label="Entrar"
                onPress={() => router.push("/login")}
                style={styles.visitorButton}
              />
              <AppButton
                label="Criar conta"
                variant="secondary"
                onPress={() => router.push("/cadastro")}
                style={styles.visitorButton}
              />
            </AppSurface>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[8] + insets.bottom + 72 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary}
          />
        }
      >
        <StandardSectionHeader
          title="Desempenho"
          subtitle="Acompanhe sua evolução"
          stats={summary}
        />

        <View style={styles.body}>
          {errorMessage ? (
            <View style={styles.errorCard}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={theme.danger}
              />
              <View style={styles.errorCopy}>
                <AppText variant="sectionTitle" style={styles.errorTitle}>Desempenho indisponível</AppText>
                <AppText variant="body" tone="muted">{errorMessage}</AppText>
              </View>
              <AppButton
                label="Tentar novamente"
                onPress={() => void loadSummary(true)}
                style={styles.retryButton}
              />
            </View>
          ) : null}

          <View style={styles.periodPicker} accessibilityRole="tablist">
            {PERIOD_OPTIONS.map((option) => (
              <MotionPressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === option.value }}
                onPress={() => setPeriod(option.value)}
                style={[
                  styles.periodButton,
                  period === option.value && styles.periodButtonActive,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.periodText,
                    period === option.value && styles.periodTextActive,
                  ]}
                >
                  {option.label}
                </AppText>
              </MotionPressable>
            ))}
          </View>

          <AppSurface variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <AppText variant="sectionTitle">Taxa de acerto</AppText>
                <AppText variant="caption" tone="muted">{periodLabel}</AppText>
              </View>
              <AppText variant="caption" tone="muted">
                {periodQuestions.toLocaleString("pt-BR")} questões
              </AppText>
            </View>
            <View style={styles.accuracyScores}>
              <View style={styles.accuracyScore}>
                <View style={[styles.accuracyDot, { backgroundColor: theme.success }]} />
                <AppText variant="sectionTitle" style={styles.accuracyNumber}>
                  {periodAccuracy}%
                </AppText>
                <AppText variant="caption" tone="muted">acertos</AppText>
              </View>
              <View style={styles.accuracyScore}>
                <View style={[styles.accuracyDot, { backgroundColor: theme.danger }]} />
                <AppText variant="sectionTitle" style={styles.accuracyNumber}>
                  {periodErrorRate}%
                </AppText>
                <AppText variant="caption" tone="muted">erros</AppText>
              </View>
            </View>
            <View
              accessibilityLabel={`${periodAccuracy}% de acertos e ${periodErrorRate}% de erros`}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: periodAccuracy }}
              style={[styles.accuracyTrack, { backgroundColor: theme.dangerSubtle }]}
            >
              {periodAnswered > 0 ? (
                <View
                  style={[
                    styles.accuracyCorrect,
                    { backgroundColor: theme.success, width: `${periodAccuracy}%` },
                  ]}
                />
              ) : null}
            </View>
          </AppSurface>

          <AppSurface variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <AppText variant="sectionTitle">Atividade</AppText>
                <AppText variant="caption" tone="muted">{chartDescription}</AppText>
              </View>
              <AppText variant="caption" style={{ color: theme.primary, fontWeight: typography.weight.semibold }}>
                {periodQuestions.toLocaleString("pt-BR")} no total
              </AppText>
            </View>
            {chartLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : chartError ? (
              <View style={styles.chartError}>
                <AppText variant="body" tone="muted">{chartError}</AppText>
                <AppLink label="Tentar novamente" onPress={() => void loadTimeline(period)} />
              </View>
            ) : chartData.every((point) => point.questions === 0) ? (
              <AppText variant="body" tone="muted">Responda questões para acompanhar sua atividade aqui.</AppText>
            ) : (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={period === 'mensal'}
              >
                <View style={[styles.chart, { width: chartWidth }]}>
                  {chartData.map((point, index) => (
                    <View
                      key={`${point.timestamp ?? point.label}-${index}`}
                      style={[styles.barColumn, period === 'mensal' && styles.monthlyBarColumn]}
                    >
                      <AppText variant="label" style={styles.barValue}>{point.questions}</AppText>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              backgroundColor: theme.primary,
                              height: point.questions > 0
                                ? `${Math.max(3, (point.questions / chartMax) * 100)}%`
                                : 0,
                            },
                          ]}
                        />
                      </View>
                      <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.barLabel}>
                        {point.label}
                      </AppText>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </AppSurface>

          <AppSurface variant="outlined" style={styles.card}>
            <AppText variant="sectionTitle">Acertos por matéria</AppText>
            {displayedSubjects.length === 0 ? (
              <AppText variant="body" tone="muted">
                Ainda não há desempenho sincronizado.
              </AppText>
            ) : (
              displayedSubjects.map((subject) => {
                const percentage = clamp(subject.accuracyRate);
                const color =
                  percentage >= 70
                    ? theme.success
                    : percentage >= 50
                      ? theme.warning
                      : theme.danger;
                return (
                  <View key={subject.subject} style={styles.subjectRow}>
                    <View style={styles.subjectHeader}>
                      <AppText variant="bodyStrong" style={styles.subjectName}>{subject.subject}</AppText>
                      <AppText variant="bodyStrong" style={{ color }}>
                        {Math.round(percentage)}%
                      </AppText>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progress,
                          { backgroundColor: color, width: `${percentage}%` },
                        ]}
                      />
                    </View>
                    <AppText variant="caption" tone="muted">
                      {subject.correctAnswers}/{subject.totalQuestions} questões
                    </AppText>
                  </View>
                );
              })
            )}
          </AppSurface>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { backgroundColor: theme.background, flex: 1 },
    content: { paddingBottom: spacing[8] + 72 },
    body: {
      gap: spacing[5],
      marginTop: -spacing[4],
      paddingHorizontal: spacing[5],
    },
    visitorGate: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[8],
    },
    visitorGateCard: {
      alignItems: "center",
      gap: spacing[3],
      padding: spacing[5],
    },
    visitorIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.pill,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    visitorTitle: { color: theme.text, textAlign: "center" },
    visitorDescription: { textAlign: "center" },
    visitorButton: { alignSelf: "stretch" },
    card: {
      borderColor: theme.border,
      borderRadius: radius.card,
      borderWidth: borders.subtle,
      gap: spacing[3],
      padding: spacing[4],
      ...(theme === darkTheme
        ? shadows.cardDark
        : {
            shadowColor: "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
          }),
    },
    errorCard: {
      alignItems: "flex-start",
      backgroundColor: theme.surface,
      borderColor: theme.danger,
      borderRadius: radius.card,
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[4],
    },
    errorCopy: { gap: spacing[1] },
    errorTitle: { color: theme.text },
    retryButton: { alignSelf: "flex-start" },
    cardHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing[2],
    },
    periodPicker: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: spacing[1],
      padding: 2,
    },
    periodButton: {
      alignItems: "center",
      borderColor: "transparent",
      borderWidth: borders.subtle,
      borderRadius: radius.sm,
      flex: 1,
      justifyContent: "center",
      minHeight: 32,
      paddingHorizontal: spacing[1],
    },
    periodButtonActive: { backgroundColor: theme.surface, borderColor: theme.border },
    periodText: { color: theme.textMuted },
    periodTextActive: {
      color: theme.text,
      fontWeight: typography.weight.semibold,
    },
    accuracyScores: {
      flexDirection: "row",
      gap: spacing[5],
      marginTop: spacing[4],
    },
    accuracyScore: { alignItems: "center", flexDirection: "row", gap: spacing[1] },
    accuracyDot: { borderRadius: radius.pill, height: 8, width: 8 },
    accuracyNumber: { color: theme.text },
    accuracyTrack: {
      borderRadius: radius.pill,
      flexDirection: "row",
      height: 9,
      marginTop: spacing[3],
      overflow: "hidden",
      width: "100%",
    },
    accuracyCorrect: { borderRadius: radius.pill, height: "100%" },
    chartError: { alignItems: 'flex-start', gap: spacing[2] },
    chart: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: spacing[2],
      height: 150,
    },
    barColumn: {
      alignItems: "center",
      flex: 1,
      gap: 4,
      height: "100%",
      justifyContent: "flex-end",
    },
    monthlyBarColumn: { flex: 0, width: 28 },
    barValue: { color: theme.text, fontWeight: typography.weight.semibold },
    barTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flex: 1,
      justifyContent: "flex-end",
      overflow: "hidden",
      width: "100%",
    },
    bar: { borderRadius: radius.sm, minHeight: 2, width: "100%" },
    barLabel: { maxWidth: 42 },
    subjectRow: { gap: 4 },
    subjectHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    subjectName: { color: theme.text },
    progressTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      height: 9,
      overflow: "hidden",
    },
    progress: { borderRadius: radius.pill, height: "100%" },
  });

export default PerformanceScreen;
