import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StandardSectionHeader } from "@/components/layout/StandardSectionHeader";
import { buildSimulationSeed } from "@/features/simulations/api/simulationQuestionPool";
import { useActiveSimulationQuery } from "@/features/simulations/api/useActiveSimulationQuery";
import { useSimulationsQuery } from "@/features/simulations/api/useSimulationsQuery";
import { useSimulationRunStore } from "@/state/simulationRunStore";
import { useAuth } from "@/providers/AuthProvider";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { MobileSimulationConfig } from "@/types/simulation";

type ReadySimulation = {
  id: string;
  title: string;
  questions: number;
  time: string;
  timerMinutes: number;
  enrolled: number;
  avgScore: number;
  difficulty: "Fácil" | "Médio" | "Difícil";
};
type ResultItem = {
  id: string;
  title: string;
  score: number;
  avg: number;
  date: string;
  questions: number;
  time: string;
};
const readySimulados: ReadySimulation[] = [
  {
    id: "inss-2024-tecnico",
    title: "INSS 2024 – Técnico",
    questions: 40,
    time: "3h",
    timerMinutes: 180,
    enrolled: 1248,
    avgScore: 72,
    difficulty: "Médio",
  },
  {
    id: "pf-agente",
    title: "Polícia Federal – Agente",
    questions: 50,
    time: "4h",
    timerMinutes: 240,
    enrolled: 892,
    avgScore: 65,
    difficulty: "Difícil",
  },
  {
    id: "trt-analista",
    title: "TRT – Analista Judiciário",
    questions: 35,
    time: "2h30",
    timerMinutes: 150,
    enrolled: 567,
    avgScore: 68,
    difficulty: "Médio",
  },
  {
    id: "receita-auditor",
    title: "Receita Federal – Auditor",
    questions: 60,
    time: "5h",
    timerMinutes: 300,
    enrolled: 2340,
    avgScore: 58,
    difficulty: "Difícil",
  },
  {
    id: "ibge-agente",
    title: "IBGE – Agente Censitário",
    questions: 25,
    time: "1h30",
    timerMinutes: 90,
    enrolled: 3120,
    avgScore: 78,
    difficulty: "Fácil",
  },
];
const previewResults: ResultItem[] = [
  {
    id: "preview-1",
    title: "INSS – Técnico (Simulado 1)",
    score: 82,
    avg: 72,
    date: "10/04/2026",
    questions: 40,
    time: "2h15",
  },
  {
    id: "preview-2",
    title: "PF – Agente (Mini)",
    score: 64,
    avg: 65,
    date: "08/04/2026",
    questions: 20,
    time: "1h05",
  },
  {
    id: "preview-3",
    title: "TRT – Analista",
    score: 71,
    avg: 68,
    date: "05/04/2026",
    questions: 35,
    time: "2h42",
  },
];
const difficultyValue: Record<ReadySimulation["difficulty"], MobileSimulationConfig["difficulty"]> = {
  Fácil: "easy",
  Médio: "medium",
  Difícil: "hard",
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
  const { user } = useAuth();
  const isPreview = user?.id === "visual-preview-user";
  const [tab, setTab] = React.useState<"prontos" | "resultados">("prontos");
  const [startingId, setStartingId] = React.useState<string | null>(null);
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

  const startPreset = React.useCallback(
    async (preset: ReadySimulation) => {
      setStartingId(preset.id);
      try {
        const seed = await buildSimulationSeed({
          questionCount: preset.questions,
          timerEnabled: true,
          timerMinutes: preset.timerMinutes,
          feedbackMode: "after_all",
          difficulty: difficultyValue[preset.difficulty],
          subjects: [],
          agencies: [],
          years: [],
          organizations: [],
          roles: [],
          topics: [],
        });
        setSeed({ ...seed, id: `sim-${preset.id}-${Date.now()}` });
        router.push("/simulados/executar");
      } catch (error: any) {
        Alert.alert(
          "Simulado",
          error?.message || "Não foi possível iniciar este simulado.",
        );
      } finally {
        setStartingId(null);
      }
    },
    [setSeed],
  );

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
      : isPreview
        ? previewResults
        : [];
  const listData: Array<ReadySimulation | ResultItem> =
    tab === "prontos" ? readySimulados : results;

  return (
    <View style={styles.screen}>
      <FlatList<ReadySimulation | ResultItem>
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
                {
                  label: "Realizados",
                  value: isPreview ? "12" : String(completedItems.length),
                  icon: "checkmark-circle-outline",
                },
                {
                  label: "Média geral",
                  value: isPreview ? "72%" : averageScore,
                  icon: "bar-chart-outline",
                },
                {
                  label: "Tempo médio",
                  value: isPreview ? "2h10" : "--",
                  icon: "time-outline",
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/simulados/novo")}
              style={styles.customCard}
            >
              <View style={styles.customIcon}>
                <Ionicons name="add" size={27} color={theme.primary} />
              </View>
              <View style={styles.customCopy}>
                <Text style={styles.customTitle}>Simulado personalizado</Text>
                <Text style={styles.customDescription}>
                  Escolha matérias, banca e quantidade
                </Text>
              </View>
              <View style={styles.createButton}>
                <Ionicons name="play-outline" size={16} color={theme.onPrimary} />
                <Text style={styles.createButtonText}>Criar</Text>
              </View>
            </Pressable>
            <View style={styles.tabs}>
              <Pressable
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
              </Pressable>
              <Pressable
                onPress={() => setTab("resultados")}
                style={[styles.tab, tab === "resultados" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "resultados" && styles.tabTextActive,
                  ]}
                >
                  Meus resultados
                </Text>
              </Pressable>
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
              <Text style={styles.emptyTitle}>
                {user ? "Nenhum resultado ainda" : "Entre para ver seus resultados"}
              </Text>
              <Text style={styles.emptyText}>
                {user
                  ? "Comece por um simulado pronto ou crie um próprio para gerar sua primeira análise."
                  : "Seu histórico de simulados, médias e insights ficam salvos na conta."}
              </Text>
              <Pressable
                onPress={() => setTab("prontos")}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Ver simulados</Text>
                <Ionicons name="arrow-forward" size={15} color={theme.onPrimary} />
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footerBlock}>
            {activeSeed ? (
              <Pressable
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
              </Pressable>
            ) : remoteActive ? (
              <Pressable onPress={resumeRemote} style={styles.resumeCard}>
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
              </Pressable>
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
        renderItem={({ item }) =>
          tab === "prontos" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{(item as ReadySimulation).title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  <Ionicons name="book-outline" size={13} color={theme.textMuted} />{" "}
                  {(item as ReadySimulation).questions} questões
                </Text>
                <Text style={styles.meta}>
                  <Ionicons name="time-outline" size={13} color={theme.textMuted} />{" "}
                  {(item as ReadySimulation).time}
                </Text>
                <Text
                  style={[
                    styles.difficulty,
                    (item as ReadySimulation).difficulty === "Fácil"
                      ? styles.easy
                      : (item as ReadySimulation).difficulty === "Médio"
                        ? styles.medium
                        : styles.hard,
                  ]}
                >
                  {(item as ReadySimulation).difficulty}
                </Text>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.statsInline}>
                  <Text style={styles.meta}>
                    <Ionicons name="people-outline" size={13} color={theme.textMuted} />{" "}
                    {(item as ReadySimulation).enrolled.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.meta}>
                    <Ionicons name="trophy-outline" size={13} color={theme.textMuted} />{" "}
                    Média: {(item as ReadySimulation).avgScore}%
                  </Text>
                </View>
                <Pressable
                  disabled={startingId !== null}
                  onPress={() => void startPreset(item as ReadySimulation)}
                  style={[
                    styles.startButton,
                    startingId === (item as ReadySimulation).id &&
                      styles.disabled,
                  ]}
                >
                  {startingId === (item as ReadySimulation).id ? (
                    <ActivityIndicator size="small" color={theme.onPrimary} />
                    ) : (
                      <>
                      <Text style={styles.startButtonText}>Iniciar</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={theme.onPrimary}
                      />
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/simulados/historico/[simulationId]",
                  params: { simulationId: String((item as any).id) },
                })
              }
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{(item as any).title}</Text>
              <Text style={styles.resultMeta}>
                {(item as any).date} · {(item as any).questions} questões ·{" "}
                {(item as any).time}
              </Text>
              <View style={styles.resultRow}>
                <View style={styles.resultProgressCopy}>
                  <View style={styles.resultScoreRow}>
                    <Text style={styles.resultLabel}>Sua nota</Text>
                    <Text
                      style={[
                        styles.resultScore,
                        (item as any).score >= (item as any).avg
                          ? styles.resultPositive
                          : styles.resultNegative,
                      ]}
                    >
                      {(item as any).score}%
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(0, Math.min(100, (item as any).score))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.average}>
                  <Text style={styles.averageLabel}>Média</Text>
                  <Text style={styles.averageValue}>
                    {(item as any).avg ? `${(item as any).avg}%` : "--"}
                  </Text>
                </View>
              </View>
              {(item as any).avg && (item as any).score >= (item as any).avg ? (
                <Text style={styles.aboveAverage}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={13}
                    color={theme.success}
                  />{" "}
                  Acima da média!
                </Text>
              ) : null}
            </Pressable>
          )
        }
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
      borderRadius: radius.lg,
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
      fontSize: 10,
      fontWeight: typography.weight.bold,
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
      borderRadius: radius.lg,
      elevation: 3,
      flexDirection: "row",
      gap: spacing[3],
      marginTop: -spacing[2],
      marginHorizontal: spacing[5],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      shadowColor: theme.text,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      zIndex: 2,
    },
    customIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.lg,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    customCopy: { flex: 1, gap: 2 },
    customTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.black,
    },
    customDescription: {
      color: theme.textMuted,
      fontSize: 10,
    },
    createButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: 4,
      minHeight: 32,
      paddingHorizontal: spacing[1],
    },
    createButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    tabs: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.lg,
      flexDirection: "row",
      marginHorizontal: spacing[5],
      marginTop: spacing[3],
      padding: 2,
    },
    tab: {
      alignItems: "center",
      borderRadius: radius.md,
      flex: 1,
      justifyContent: "center",
      minHeight: 28,
    },
    tabActive: { backgroundColor: theme.surface, elevation: 1 },
    tabText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    tabTextActive: { color: theme.text },
    card: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      elevation: 2,
      gap: spacing[3],
      marginHorizontal: spacing[5],
      padding: spacing[4],
      shadowColor: theme.text,
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[3],
    },
    meta: { color: theme.textMuted, fontSize: typography.size.xs },
    difficulty: {
      borderRadius: radius.pill,
      fontSize: 10,
      fontWeight: typography.weight.bold,
      overflow: "hidden",
      paddingHorizontal: spacing[2],
      paddingVertical: 3,
    },
    easy: { backgroundColor: theme.successSubtle, color: theme.success },
    medium: { backgroundColor: theme.warningSubtle, color: theme.warning },
    hard: { backgroundColor: theme.dangerSubtle, color: theme.danger },
    cardFooter: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statsInline: { flexDirection: "row", flex: 1, gap: spacing[3] },
    startButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: 3,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: spacing[3],
    },
    startButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    disabled: { opacity: 0.6 },
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
      fontSize: 10,
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
      gap: spacing[2],
      paddingVertical: spacing[10],
    },
    emptyTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    emptyText: { color: theme.textMuted, fontSize: typography.size.sm },
    emptyButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      marginTop: spacing[3],
      minHeight: 44,
      paddingHorizontal: spacing[4],
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.black,
      textTransform: "uppercase",
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
      fontSize: 10,
      fontWeight: typography.weight.black,
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
