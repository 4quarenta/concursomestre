import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveSimulationQuery } from "@/features/simulations/api/useActiveSimulationQuery";
import { useSimulationsQuery } from "@/features/simulations/api/useSimulationsQuery";
import { useSimulationRunStore } from "@/state/simulationRunStore";
import { useAuth } from "@/providers/AuthProvider";
import { StandardSectionHeader } from "@/components/layout/StandardSectionHeader";
import { MotionPressable } from "@/components/ui/Primitives";
import { darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
type ResultItem = {
  id: string;
  title: string;
  score: number;
  avg: number;
  date: string;
  questions: number;
  time: string;
};
const formatDate = (rawValue: number | string | undefined): string => {
  if (rawValue === undefined || rawValue === null) return "--";
  const numeric = Number(rawValue);
  const date =
    Number.isFinite(numeric) && numeric > 0
      ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
      : new Date(String(rawValue));
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString("pt-BR");
};

export const SimulationsScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user;
  const [tab, setTab] = React.useState<"prontos" | "resultados">("prontos");
  const simulationsQuery = useSimulationsQuery();
  const activeRemoteQuery = useActiveSimulationQuery();
  const activeSeed = useSimulationRunStore((state) => state.seed);
  const activeAnswers = useSimulationRunStore((state) => state.answers);
  const setSeed = useSimulationRunStore((state) => state.setSeed);
  const replaceAnswers = useSimulationRunStore((state) => state.replaceAnswers);
  const setCurrentIndex = useSimulationRunStore(
    (state) => state.setCurrentIndex,
  );
  const items = simulationsQuery.data ?? [];
  const remoteActive = !activeSeed ? activeRemoteQuery.data : null;
  const completedItems = items.filter(
    (item) =>
      item.status !== "in_progress" && Number.isFinite(Number(item.score)),
  );
  const averageScore = completedItems.length
    ? `${Math.round(completedItems.reduce((sum, item) => sum + Number(item.score), 0) / completedItems.length)}%`
    : "--";
  const averageScoreValue = completedItems.length
    ? Math.round(
        completedItems.reduce((sum, item) => sum + Number(item.score), 0) /
          completedItems.length,
      )
    : 0;

  const resumeRemote = React.useCallback(() => {
    if (!remoteActive?.questions?.length) return;
    const restoredAnswers = Object.fromEntries(
      Object.entries(remoteActive.answers || {})
        .map(([id, raw]) => [
          id,
          typeof raw === "object" ? Number((raw as any)?.index) : Number(raw),
        ])
        .filter(([, index]) => Number.isFinite(index)),
    ) as Record<string, number>;
    setSeed({
      id: remoteActive.id,
      config: {
        questionCount: remoteActive.questions.length,
        timerEnabled: Boolean(remoteActive.config?.timerEnabled),
        timerMinutes: Math.max(
          1,
          Number(remoteActive.config?.timerMinutes || 20),
        ),
        feedbackMode: "after_all",
        difficulty: "all",
      },
      questions: remoteActive.questions,
      startedAt: Number(remoteActive.startTime || Date.now()),
    });
    replaceAnswers(restoredAnswers);
    const firstUnanswered = remoteActive.questions.findIndex(
      (question, index) =>
        restoredAnswers[String(question.id ?? `idx-${index}`)] === undefined,
    );
    setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    router.push("/simulados/executar");
  }, [remoteActive, replaceAnswers, setCurrentIndex, setSeed]);

  React.useEffect(() => {
    if (isVisitor && tab === "resultados") setTab("prontos");
  }, [isVisitor, tab]);

  if (simulationsQuery.isPending)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  const results: ResultItem[] =
    completedItems.length > 0
      ? completedItems.map((item) => ({
          id: item.id,
          title: item.name || `Simulado ${item.id}`,
          score: Number(item.score),
          avg: averageScoreValue,
          date: formatDate(item.updatedAt || item.createdAt),
          questions: item.questionCount || 0,
          time: "--",
        }))
      : [];
  const listData: ResultItem[] = tab === "resultados" ? results : [];

  return (
    <View style={styles.screen}>
      <FlatList<ResultItem>
        data={listData}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={
              simulationsQuery.isRefetching || activeRemoteQuery.isRefetching
            }
            onRefresh={() => {
              void simulationsQuery.refetch();
              void activeRemoteQuery.refetch();
            }}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: spacing[8] + insets.bottom + 64,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <StandardSectionHeader
              title="Simulados"
              subtitle="Teste seus conhecimentos em provas reais"
              stats={[
                { label: "Realizados", value: String(completedItems.length), icon: "checkmark-circle-outline" },
                { label: "Média geral", value: averageScore, icon: "bar-chart-outline" },
                { label: "Tempo médio", value: "--", icon: "time-outline" },
              ]}
            />
            <MotionPressable
              accessibilityRole="button"
              onPress={() => router.push("/simulados/novo")}
              accessibilityLabel="Monte seu simulado personalizado"
              style={styles.customCard}
            >
              <View style={styles.customIcon}>
                <Ionicons name="options-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.customCopy}>
                <Text style={styles.customTitle}>Monte seu simulado</Text>
                <Text style={styles.customDescription}>
                  Escolha matérias, banca e número de questões
                </Text>
              </View>
              <View style={styles.customAction}>
                <Ionicons name="arrow-forward" size={16} color={theme.primary} />
              </View>
            </MotionPressable>
            <View style={styles.tabs}>
              <MotionPressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === "prontos" }}
                onPress={() => setTab("prontos")}
                style={[styles.tab, tab === "prontos" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "prontos" && styles.tabTextActive,
                  ]}
                  >
                  Simulados prontos
                </Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="tab"
                accessibilityState={{ disabled: isVisitor, selected: tab === "resultados" }}
                disabled={isVisitor}
                onPress={() => setTab("resultados")}
                style={[styles.tab, tab === "resultados" && styles.tabActive, isVisitor && styles.tabDisabled]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "resultados" && styles.tabTextActive,
                  ]}
                >
                  Meus resultados
                </Text>
              </MotionPressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          tab === "resultados" ? (
            <View style={styles.empty}>
              <Ionicons
                name="bar-chart-outline"
                size={48}
                color={theme.textSubtle}
              />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>
                  {user ? "Nenhum resultado por enquanto" : "Entre para ver seus resultados"}
                </Text>
                <Text style={styles.emptyText}>
                  {user
                    ? "Conclua um simulado para acompanhar seu desempenho e evolução."
                    : "Seu histórico de simulados, médias e insights ficam salvos na conta."}
                </Text>
              </View>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => setTab("prontos")}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Ver simulados</Text>
                <Ionicons name="arrow-forward" size={15} color={theme.onPrimary} />
              </MotionPressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={theme.textSubtle}
              />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>
                  Nenhum simulado pronto disponível
                </Text>
                <Text style={styles.emptyText}>
                  Novos simulados aparecerão aqui quando forem publicados. Enquanto isso,
                  crie um simulado personalizado.
                </Text>
              </View>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => router.push("/simulados/novo")}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Criar simulado</Text>
                <Ionicons name="arrow-forward" size={15} color={theme.onPrimary} />
              </MotionPressable>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footerBlock}>
            {activeSeed ? (
              <MotionPressable
                accessibilityRole="button"
                onPress={() => router.push("/simulados/executar")}
                style={styles.resumeCard}
              >
                <View style={styles.resumeCopy}>
                  <Text style={styles.resumeEyebrow}>
                    Em andamento neste aparelho
                  </Text>
                  <Text style={styles.resumeTitle}>Continuar simulado</Text>
                  <Text style={styles.resumeDescription}>
                    {Object.keys(activeAnswers).length} de{" "}
                    {activeSeed.questions.length} questões respondidas
                  </Text>
                </View>
                <Text style={styles.resumeAction}>Continuar</Text>
              </MotionPressable>
            ) : remoteActive ? (
              <MotionPressable accessibilityRole="button" onPress={resumeRemote} style={styles.resumeCard}>
                <View style={styles.resumeCopy}>
                  <Text style={styles.resumeEyebrow}>Sincronizado</Text>
                  <Text style={styles.resumeTitle}>
                    Retomar simulado em andamento
                  </Text>
                  <Text style={styles.resumeDescription}>
                    {Object.keys(remoteActive.answers || {}).length} de{" "}
                    {remoteActive.questions?.length || 0} questões respondidas
                  </Text>
                </View>
                <Text style={styles.resumeAction}>Retomar</Text>
              </MotionPressable>
            ) : null}
            {tab === "resultados" && results.length > 0 ? (
              <View style={styles.insightsCard}>
                <View style={styles.insightsHeader}>
                  <View style={styles.insightsIcon}>
                    <Ionicons name="bulb-outline" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.insightsCopy}>
                    <Text style={styles.insightsEyebrow}>Insights</Text>
                    <Text style={styles.insightsTitle}>Leitura dos seus resultados</Text>
                  </View>
                </View>
                <Text style={styles.insightItem}>
                  Continue acompanhando sua média para identificar sua evolução.
                </Text>
                <Text style={styles.insightItem}>
                  Revise os simulados com menor desempenho antes de aumentar o ritmo.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <MotionPressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/simulados/historico/[simulationId]",
                params: { simulationId: item.id },
              })
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.resultMeta}>
              {item.date} · {item.questions} questões · {item.time}
            </Text>
            <View style={styles.resultRow}>
              <View style={styles.resultProgressCopy}>
                <View style={styles.resultScoreRow}>
                  <Text style={styles.resultLabel}>Sua nota</Text>
                  <Text
                    style={[
                      styles.resultScore,
                      item.score >= item.avg
                        ? styles.resultPositive
                        : styles.resultNegative,
                    ]}
                  >
                    {item.score}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(0, Math.min(100, item.score))}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.average}>
                <Text style={styles.averageLabel}>Média</Text>
                <Text style={styles.averageValue}>
                  {item.avg ? `${item.avg}%` : "--"}
                </Text>
              </View>
            </View>
            {item.avg && item.score >= item.avg ? (
              <Text style={styles.aboveAverage}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={13}
                  color={theme.success}
                />{" "}
                Acima da média!
              </Text>
            ) : null}
          </MotionPressable>
        )}
      />
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { backgroundColor: theme.background, flex: 1 },
    loader: {
      alignItems: "center",
      backgroundColor: theme.background,
      flex: 1,
      justifyContent: "center",
    },
    listContent: { gap: spacing[3] },
    headerBlock: { gap: 0 },
    footerBlock: { gap: spacing[4] },
    resumeCard: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
      borderRadius: radius.card,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      justifyContent: "space-between",
      marginHorizontal: spacing[5],
      padding: spacing[4],
    },
    resumeCopy: { flex: 1, gap: spacing[1] },
    resumeEyebrow: {
      color: theme.primary,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      fontWeight: typography.role.label.fontWeight,
      textTransform: "uppercase",
    },
    resumeTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.extrabold,
    },
    resumeDescription: { color: theme.textMuted, fontSize: typography.size.xs },
    resumeAction: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    customCard: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.card,
      flexDirection: "row",
      gap: spacing[3],
      marginHorizontal: spacing[5],
      marginTop: -spacing[4],
      minHeight: 96,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      ...(theme === darkTheme ? shadows.cardDark : {}),
      zIndex: 2,
    },
    customIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.lg,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    customCopy: { flex: 1, gap: 2, minWidth: 0 },
    customTitle: {
      color: theme.text,
      fontSize: typography.role.sectionTitle.fontSize,
      lineHeight: typography.role.sectionTitle.lineHeight,
      fontWeight: typography.role.sectionTitle.fontWeight,
    },
    customDescription: {
      color: theme.textMuted,
      fontSize: typography.role.body.fontSize,
      lineHeight: typography.role.body.lineHeight,
    },
    customAction: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.pill,
      flexShrink: 0,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    tabs: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.lg,
      flexDirection: "row",
      marginHorizontal: spacing[5],
      marginTop: spacing[3],
      padding: 4,
    },
    tab: {
      alignItems: "center",
      borderRadius: radius.md,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
    },
    tabActive: { backgroundColor: theme.primary },
    tabDisabled: { opacity: 0.45 },
    tabText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    tabTextActive: { color: theme.onPrimary },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.card,
      gap: spacing[3],
      marginHorizontal: spacing[5],
      padding: spacing[4],
      ...(theme === darkTheme ? shadows.cardDark : {}),
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    resultMeta: { color: theme.textMuted, fontSize: typography.size.xs },
    resultRow: { alignItems: "center", flexDirection: "row", gap: spacing[4] },
    resultProgressCopy: { flex: 1 },
    resultScoreRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing[2],
    },
    resultLabel: { color: theme.textMuted, fontSize: typography.size.sm },
    resultScore: {
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    resultPositive: { color: theme.success },
    resultNegative: { color: theme.danger },
    progressTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      height: 10,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: theme.primary,
      borderRadius: radius.pill,
      height: "100%",
    },
    average: {
      borderLeftColor: theme.border,
      borderLeftWidth: 1,
      minWidth: 52,
      paddingLeft: spacing[3],
    },
    averageLabel: {
      color: theme.textMuted,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      textTransform: "uppercase",
    },
    averageValue: {
      color: theme.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    aboveAverage: {
      color: theme.success,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    empty: {
      alignItems: "center",
      alignSelf: "stretch",
      gap: spacing[2],
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[10],
    },
    emptyCopy: {
      alignItems: "center",
      alignSelf: "center",
      gap: spacing[2],
      maxWidth: 300,
      width: "100%",
    },
    emptyTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
      textAlign: "center",
      maxWidth: "100%",
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      lineHeight: 21,
      textAlign: "center",
      maxWidth: "100%",
    },
    emptyButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.button,
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      alignSelf: "center",
      marginTop: spacing[3],
      minHeight: 44,
      paddingHorizontal: spacing[4],
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: typography.role.button.fontSize,
      lineHeight: typography.role.button.lineHeight,
      fontWeight: typography.role.button.fontWeight,
    },
    insightsCard: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[3],
      marginHorizontal: spacing[5],
      marginTop: spacing[4],
      padding: spacing[4],
    },
    insightsHeader: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
    insightsIcon: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    insightsCopy: { flex: 1, gap: 2 },
    insightsEyebrow: {
      color: theme.primary,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      fontWeight: typography.role.label.fontWeight,
      textTransform: "uppercase",
    },
    insightsTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    insightItem: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      lineHeight: 18,
      padding: spacing[3],
    },
  });

export default SimulationsScreen;
