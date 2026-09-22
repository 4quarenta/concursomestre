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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StandardSectionHeader } from "@/components/layout/StandardSectionHeader";
import { useAuth } from "@/providers/AuthProvider";
import { statisticsService } from "@/services/statistics/statisticsService";
import { readApiErrorMessage } from "@/services/api/response";
import { radius, spacing, typography } from "@/theme/tokens";
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [period, setPeriod] = React.useState<Period>("semanal");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const load = React.useCallback(
    async (refresh = false) => {
      if (!user?.id) {
        setStats(EMPTY_STATS);
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      setErrorMessage("");
      try {
        setStats(await statisticsService.getUserStatistics(user.id));
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
        refresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [user?.id],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const chartData = React.useMemo(() => {
    const points =
      period === "semanal"
        ? stats.timeline.slice(-7)
        : stats.timeline.slice(-30);
    return points.length > 0
      ? points
      : [{ label: "--", questions: 0, correct: 0, wrong: 0 }];
  }, [period, stats.timeline]);
  const chartMax = Math.max(1, ...chartData.map((point) => point.questions));
  const displayedSubjects = stats.subjectBreakdown
    .slice()
    .sort((a, b) => b.totalQuestions - a.totalQuestions)
    .slice(0, 8);
  const hours = Math.round((stats.totalStudyTime || 0) / 3600);
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
      value: `${stats.currentStreak}d`,
      icon: "flame-outline" as const,
    },
    { label: "Horas", value: `${hours}h`, icon: "calendar-outline" as const },
  ];

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
                <Text style={styles.errorTitle}>Desempenho indisponível</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Atividade</Text>
              <View style={styles.periodPicker}>
                {(["semanal", "mensal"] as Period[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setPeriod(option)}
                    style={[
                      styles.periodButton,
                      period === option && styles.periodButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        period === option && styles.periodTextActive,
                      ]}
                    >
                      {option === "semanal" ? "Semanal" : "Mensal"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.chartLabel}>
              <Ionicons
                name="bar-chart-outline"
                size={13}
                color={theme.textMuted}
              />
              <Text style={styles.muted}>
                {chartData.reduce((sum, item) => sum + item.questions, 0)}{" "}
                questões
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <View style={styles.chart}>
                {chartData.map((point, index) => (
                  <View
                    key={`${point.label}-${index}`}
                    style={styles.barColumn}
                  >
                    <Text style={styles.barValue}>{point.questions}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            backgroundColor: theme.primary,
                            height: `${(point.questions / chartMax) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text numberOfLines={1} style={styles.barLabel}>
                      {point.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acertos por matéria</Text>
            {displayedSubjects.length === 0 ? (
              <Text style={styles.empty}>
                Ainda não há desempenho sincronizado.
              </Text>
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
                      <Text style={styles.subjectName}>{subject.subject}</Text>
                      <Text style={[styles.subjectPercent, { color }]}>
                        {Math.round(percentage)}%
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progress,
                          { backgroundColor: color, width: `${percentage}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.subjectMeta}>
                      {subject.correctAnswers}/{subject.totalQuestions} questões
                    </Text>
                  </View>
                );
              })
            )}
          </View>
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
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      elevation: 3,
      gap: spacing[3],
      padding: spacing[5],
      shadowColor: theme.text,
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    errorCard: {
      alignItems: "flex-start",
      backgroundColor: theme.surface,
      borderColor: theme.danger,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[4],
    },
    errorCopy: { gap: spacing[1] },
    errorTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    errorText: { color: theme.textMuted, fontSize: typography.size.sm },
    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: theme.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    retryText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    periodPicker: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flexDirection: "row",
      padding: 2,
    },
    periodButton: {
      borderRadius: radius.sm,
      paddingHorizontal: spacing[2],
      paddingVertical: 5,
    },
    periodButtonActive: { backgroundColor: theme.surface, elevation: 1 },
    periodText: { color: theme.textMuted, fontSize: 11 },
    periodTextActive: {
      color: theme.text,
      fontWeight: typography.weight.semibold,
    },
    chartLabel: { alignItems: "center", flexDirection: "row", gap: 4 },
    muted: { color: theme.textMuted, fontSize: typography.size.xs },
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
    barValue: {
      color: theme.text,
      fontSize: 10,
      fontWeight: typography.weight.semibold,
    },
    barTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flex: 1,
      justifyContent: "flex-end",
      overflow: "hidden",
      width: "100%",
    },
    bar: { borderRadius: radius.sm, minHeight: 2, width: "100%" },
    barLabel: { color: theme.textMuted, fontSize: 10, maxWidth: 42 },
    subjectRow: { gap: 4 },
    subjectHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    subjectName: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    subjectPercent: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    progressTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      height: 9,
      overflow: "hidden",
    },
    progress: { borderRadius: radius.pill, height: "100%" },
    subjectMeta: { color: theme.textMuted, fontSize: 10 },
    empty: { color: theme.textMuted, fontSize: typography.size.sm },
  });

export default PerformanceScreen;
