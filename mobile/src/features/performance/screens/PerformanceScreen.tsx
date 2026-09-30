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
import { touchStudyStreak } from "@/services/statistics/studyStreakService";
import { readApiErrorMessage } from "@/services/api/response";
import { borders, darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { UserStatistics } from "@/types/statistics";

type Period = "semanal" | "mensal";

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

export const PerformanceScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [studyStreak, setStudyStreak] = React.useState(0);
  const [period, setPeriod] = React.useState<Period>("semanal");
  const [chartLoading, setChartLoading] = React.useState(true);
  const [chartError, setChartError] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const load = React.useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        setStats(EMPTY_STATS);
        setChartLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      setChartLoading(true);
      setErrorMessage("");
      setChartError('');
      try {
        const [statisticsResult, timelineResult, answerSnapshotResult] = await Promise.allSettled([
          statisticsService.getUserStatistics(user.id),
          statisticsService.getCurrentUserQuestionTimeline(period),
          statisticsService.getCurrentUserAnswerSnapshot(),
        ]);
        if (statisticsResult.status === 'fulfilled') {
          setStats(statisticsResult.value);
        } else {
          setErrorMessage(readApiErrorMessage(
            statisticsResult.reason,
            "Não foi possível carregar seu desempenho agora.",
          ));
        }
        if (timelineResult.status === 'fulfilled') {
          setStats((current) => ({ ...current, timeline: timelineResult.value }));
        } else {
          setChartError(readApiErrorMessage(
            timelineResult.reason,
            'Não foi possível carregar sua atividade agora.',
          ));
        }
        if (answerSnapshotResult.status === 'fulfilled') {
          setStats((current) => ({
            ...current,
            ...answerSnapshotResult.value.summary,
            subjectBreakdown: answerSnapshotResult.value.subjectBreakdown.length > 0
              ? answerSnapshotResult.value.subjectBreakdown
              : current.subjectBreakdown,
          }));
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
        setChartLoading(false);
      }
    },
    [period, user?.id],
  );

  useFocusEffect(React.useCallback(() => {
    void load();
    return undefined;
  }, [load]));

  React.useEffect(() => {
    let active = true;
    if (user?.id) {
      void touchStudyStreak(user.id).then((snapshot) => {
        if (active) setStudyStreak(snapshot.current);
      });
    } else {
      setStudyStreak(0);
    }
    return () => { active = false; };
  }, [user?.id]);

  const chartData = stats.timeline;
  const chartMax = Math.max(1, ...chartData.map((point) => point.questions));
  const chartViewportWidth = Math.max(180, screenWidth - spacing[5] * 4);
  const chartWidth = period === 'mensal'
    ? Math.max(chartViewportWidth, chartData.length * 36)
    : chartViewportWidth;
  const displayedSubjects = stats.subjectBreakdown
    .slice()
    .sort((a, b) => b.totalQuestions - a.totalQuestions)
    .slice(0, 8);
  const totalStudyMinutes = Math.floor(Math.max(0, stats.totalStudyTime || 0) / 60);
  const formattedStudyTime = totalStudyMinutes >= 60
    ? `${Math.floor(totalStudyMinutes / 60)}h${totalStudyMinutes % 60 > 0 ? ` ${totalStudyMinutes % 60}min` : ""}`
    : `${totalStudyMinutes}min`;
  const summary = [
    {
      label: "Questões",
      value: stats.totalQuestionsAnswered.toLocaleString("pt-BR"),
      icon: "book-outline" as const,
    },
    {
      label: "Acerto",
      value: `${Math.round(clamp(stats.accuracyRate))}%`,
      icon: "flag-outline" as const,
    },
    {
      label: "Streak",
      value: `${studyStreak}d`,
      icon: "flame-outline" as const,
    },
    { label: "Tempo de estudo", value: formattedStudyTime, icon: "calendar-outline" as const },
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
            onRefresh={() => void load(true)}
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
                onPress={() => void load()}
                style={styles.retryButton}
              />
            </View>
          ) : null}

          <AppSurface variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="sectionTitle">Atividade</AppText>
              <View style={styles.periodPicker}>
                {(["semanal", "mensal"] as Period[]).map((option) => (
                  <MotionPressable
                    key={option}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: period === option }}
                    onPress={() => setPeriod(option)}
                    style={[
                      styles.periodButton,
                      period === option && styles.periodButtonActive,
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={[
                        styles.periodText,
                        period === option && styles.periodTextActive,
                      ]}
                    >
                      {option === "semanal" ? "Semanal" : "Mensal"}
                    </AppText>
                  </MotionPressable>
                ))}
              </View>
            </View>
            <View style={styles.chartLabel}>
              <Ionicons
                name="bar-chart-outline"
                size={13}
                color={theme.textMuted}
              />
              <AppText variant="caption" tone="muted">
                {chartData.reduce((sum, item) => sum + item.questions, 0)}{" "}
                questões
              </AppText>
            </View>
            {chartLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : chartError ? (
              <View style={styles.chartError}>
                <AppText variant="body" tone="muted">{chartError}</AppText>
                <AppLink label="Tentar novamente" onPress={() => void load()} />
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
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    periodPicker: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flexDirection: "row",
      padding: 2,
    },
    periodButton: {
      alignItems: "center",
      borderColor: "transparent",
      borderWidth: borders.subtle,
      borderRadius: radius.sm,
      justifyContent: "center",
      minHeight: 32,
      paddingHorizontal: spacing[2],
    },
    periodButtonActive: { backgroundColor: theme.surface, borderColor: theme.border },
    periodText: { color: theme.textMuted },
    periodTextActive: {
      color: theme.text,
      fontWeight: typography.weight.semibold,
    },
    chartLabel: { alignItems: "center", flexDirection: "row", gap: 4 },
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
