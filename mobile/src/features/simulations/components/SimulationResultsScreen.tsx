import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { SimulationSubpageHeader } from "@/features/simulations/components/SimulationSubpageHeader";

type RowStatus = "correct" | "wrong" | "blank";
type ResultFilter = "all" | RowStatus;

export type SimulationReviewRow = {
  id: string;
  questionNumber: number;
  status: RowStatus;
  statement: string;
  metadata: string[];
  selectedAnswer?: string;
  correctAnswer?: string;
};

type Props = {
  title: string;
  percentage: number;
  correct: number;
  total: number;
  wrong: number;
  blank: number;
  elapsedSeconds?: number;
  secondsPerQuestion?: number;
  difficulty?: string;
  rows: SimulationReviewRow[];
  onBack: () => void;
};

const formatDuration = (seconds?: number): string => {
  if (!Number.isFinite(seconds) || Number(seconds) < 0) return "—";
  const safe = Math.floor(Number(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return hours > 0
    ? `${hours}h${String(minutes).padStart(2, "0")}`
    : `${minutes}min ${String(rest).padStart(2, "0")}s`;
};

const STATUS_LABEL: Record<RowStatus, string> = {
  correct: "Acertou",
  wrong: "Errou",
  blank: "Em branco",
};

export const SimulationResultsScreen: React.FC<Props> = ({
  title,
  percentage,
  correct,
  total,
  wrong,
  blank,
  elapsedSeconds,
  secondsPerQuestion,
  difficulty,
  rows,
  onBack,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<ResultFilter>("all");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const visibleRows = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const filters: Array<[ResultFilter, string, number]> = [
    ["all", "Todas", total],
    ["correct", "Acertos", correct],
    ["wrong", "Erros", wrong],
    ["blank", "Em branco", blank],
  ];
  const stats = [
    { icon: "time-outline" as const, value: formatDuration(elapsedSeconds), label: "Tempo de prova" },
    { icon: "document-text-outline" as const, value: formatDuration(secondsPerQuestion), label: "Média por questão" },
    { icon: "bar-chart-outline" as const, value: difficulty || "—", label: "Dificuldade" },
  ];

  return (
    <View style={styles.screen}>
      <SimulationSubpageHeader title="Resultado do simulado" onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[5] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <View style={styles.scoreRing}>
            <Text style={styles.percentage}>{percentage}%</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow}>Seu desempenho</Text>
            <Text style={styles.summaryTitle}>{title}</Text>
            <Text style={styles.summaryScore}>
              {correct} acertos de {total}
            </Text>
            <Text style={styles.summaryHint}>
              Revise as questões para consolidar o que aprendeu.
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={18} color={theme.primary} />
              <Text numberOfLines={1} style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map(([value, label, count]) => {
            const active = filter === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                {value !== "all" ? (
                  <View
                    style={[
                      styles.filterDot,
                      value === "correct" && styles.correctDot,
                      value === "wrong" && styles.wrongDot,
                      value === "blank" && styles.blankDot,
                    ]}
                  />
                ) : null}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleRows.length ? (
          <View style={styles.reviewList}>
            {visibleRows.map((row) => {
              const isExpanded = Boolean(expanded[row.id]);
              const correctStatus = row.status === "correct";
              const blankStatus = row.status === "blank";
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Questão ${row.questionNumber}, ${STATUS_LABEL[row.status]}`}
                  onPress={() => setExpanded((old) => ({ ...old, [row.id]: !old[row.id] }))}
                  style={styles.reviewCard}
                >
                  <View style={[styles.statusIcon, correctStatus ? styles.statusCorrect : blankStatus ? styles.statusBlank : styles.statusWrong]}>
                    <Ionicons
                      name={correctStatus ? "checkmark" : blankStatus ? "remove" : "close"}
                      size={18}
                      color={theme.onPrimary}
                    />
                  </View>
                  <View style={styles.reviewCopy}>
                    <View style={styles.reviewHeading}>
                      <Text style={styles.reviewTitle}>Questão {row.questionNumber}</Text>
                      <Text style={[styles.statusLabel, correctStatus ? styles.textCorrect : blankStatus ? styles.textMuted : styles.textWrong]}>
                        {STATUS_LABEL[row.status]}
                      </Text>
                    </View>
                    {row.metadata.length ? (
                      <View style={styles.metadataRow}>
                        {row.metadata.slice(0, 2).map((item) => (
                          <Text key={item} numberOfLines={1} style={styles.metadataChip}>{item}</Text>
                        ))}
                      </View>
                    ) : null}
                    <Text numberOfLines={isExpanded ? undefined : 2} style={styles.statement}>
                      {row.statement || "Enunciado indisponível."}
                    </Text>
                    {isExpanded ? (
                      <View style={styles.answerDetails}>
                        <Text style={styles.answerText}>Sua resposta: {row.selectedAnswer || "Em branco"}</Text>
                        <Text style={styles.answerText}>Gabarito: {row.correctAnswer || "Indisponível"}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-forward"} size={18} color={theme.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma questão nesta categoria.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing[3]) + spacing[2] }]}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backToSimulations}>
          <Ionicons name="arrow-back" size={18} color={theme.onPrimary} />
          <Text style={styles.backToSimulationsText}>Voltar para simulados</Text>
        </Pressable>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  scroll: { flex: 1 },
  content: { gap: spacing[4], padding: spacing[4] },
  summary: {
    alignItems: "center",
    backgroundColor: theme.primary,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 142,
    padding: spacing[4],
  },
  scoreRing: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 48,
    borderWidth: 5,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  percentage: { color: theme.onPrimary, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  summaryCopy: { flex: 1, gap: spacing[1] },
  summaryEyebrow: { color: "rgba(255,255,255,0.82)", fontSize: typography.size.xs },
  summaryTitle: { color: theme.onPrimary, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  summaryScore: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  summaryHint: { color: "rgba(255,255,255,0.82)", fontSize: 10, lineHeight: 14 },
  stats: { flexDirection: "row", gap: spacing[2] },
  statCard: {
    alignItems: "flex-start",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing[1],
    minHeight: 94,
    padding: spacing[3],
  },
  statValue: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  statLabel: { color: theme.textMuted, fontSize: 10, lineHeight: 13 },
  filters: { gap: spacing[2], paddingRight: spacing[4] },
  filterChip: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 38,
    paddingHorizontal: spacing[3],
  },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterDot: { borderRadius: radius.pill, height: 8, width: 8 },
  correctDot: { backgroundColor: theme.success },
  wrongDot: { backgroundColor: theme.danger },
  blankDot: { backgroundColor: theme.textSubtle },
  filterText: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  filterTextActive: { color: theme.onPrimary },
  reviewList: { gap: spacing[3] },
  reviewCard: {
    alignItems: "flex-start",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3],
  },
  statusIcon: { alignItems: "center", borderRadius: radius.pill, height: 30, justifyContent: "center", width: 30 },
  statusCorrect: { backgroundColor: theme.success },
  statusWrong: { backgroundColor: theme.danger },
  statusBlank: { backgroundColor: theme.textSubtle },
  reviewCopy: { flex: 1, gap: spacing[1] },
  reviewHeading: { alignItems: "center", flexDirection: "row", gap: spacing[2], justifyContent: "space-between" },
  reviewTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  statusLabel: { fontSize: 10, fontWeight: typography.weight.semibold },
  textCorrect: { color: theme.success },
  textWrong: { color: theme.danger },
  textMuted: { color: theme.textMuted },
  metadataRow: { flexDirection: "row", gap: spacing[1] },
  metadataChip: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, color: theme.textMuted, fontSize: 9, maxWidth: "50%", overflow: "hidden", paddingHorizontal: spacing[2], paddingVertical: 2 },
  statement: { color: theme.textMuted, fontSize: typography.size.xs, lineHeight: 17 },
  answerDetails: { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[1], marginTop: spacing[1], paddingTop: spacing[2] },
  answerText: { color: theme.text, fontSize: typography.size.xs },
  empty: { alignItems: "center", paddingVertical: spacing[8] },
  emptyText: { color: theme.textMuted, fontSize: typography.size.sm },
  bottomBar: { backgroundColor: theme.background, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  backToSimulations: { alignItems: "center", backgroundColor: theme.primary, borderRadius: radius.md, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 50, paddingHorizontal: spacing[4] },
  backToSimulationsText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});
