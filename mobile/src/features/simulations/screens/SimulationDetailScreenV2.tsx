import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSimulationDetailQuery } from "@/features/simulations/api/useSimulationDetailQuery";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Question } from "@/types/questions";

type ReviewFilter = "all" | "correct" | "wrong" | "blank";

const stripHtml = (value?: string) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const answerLabel = (value?: number) =>
  value === undefined || value < 0 ? "--" : String.fromCharCode(65 + value);
const questionKey = (question: Question, index: number) =>
  String(question.id ?? `idx-${index}`);

const correctIndex = (question: Question): number => {
  if (Number.isFinite(Number(question.correctOptionIndex)))
    return Number(question.correctOptionIndex);
  const options = question.itens || [];
  const answerId = Number(question.resposta ?? -1);
  const byId = options.findIndex((item) => Number(item.id) === answerId);
  return byId >= 0
    ? byId
    : answerId >= 0 && answerId < options.length
      ? answerId
      : -1;
};

export const SimulationDetailScreenV2: React.FC = () => {
  const params = useLocalSearchParams<{ simulationId?: string | string[] }>();
  const simulationId = Array.isArray(params.simulationId)
    ? params.simulationId[0]
    : params.simulationId || "";
  const query = useSimulationDetailQuery(simulationId);
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<ReviewFilter>("all");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  if (query.isPending)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );

  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Detalhe indisponivel</Text>
        <Text style={styles.muted}>
          {query.error instanceof Error
            ? query.error.message
            : "Nao foi possivel carregar este simulado."}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void query.refetch()}
        >
          <Text style={styles.primaryText}>Tentar novamente</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const detail = query.data;
  const rows = (detail.questions || []).map((question, index) => {
    const key = questionKey(question, index);
    const raw = detail.answers?.[key];
    const selected =
      typeof raw === "object"
        ? Number(raw?.index)
        : raw !== undefined
          ? Number(raw)
          : undefined;
    const selectedIndex =
      selected !== undefined && Number.isFinite(selected)
        ? selected
        : undefined;
    const answer = correctIndex(question);
    const status: Exclude<ReviewFilter, "all"> =
      selectedIndex === undefined
        ? "blank"
        : selectedIndex === answer
          ? "correct"
          : "wrong";
    return {
      question,
      index,
      key,
      selectedIndex,
      correctIndex: answer,
      status,
    };
  });

  const correct = rows.filter((row) => row.status === "correct").length;
  const wrong = rows.filter((row) => row.status === "wrong").length;
  const blank = rows.filter((row) => row.status === "blank").length;
  const total = rows.length || Number(detail.questionCount || 0);
  const score = Number(detail.score ?? correct);
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const visible =
    filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const filters: Array<[ReviewFilter, string, number]> = [
    ["all", "Todas", total],
    ["correct", "Acertos", correct],
    ["wrong", "Erros", wrong],
    ["blank", "Em branco", blank],
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: spacing[4], paddingBottom: spacing[10] + insets.bottom },
      ]}
    >
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>Resultado autoritativo</Text>
        <Text style={styles.title}>
          {detail.name || `Simulado ${detail.id}`}
        </Text>
        <Text style={styles.score}>
          {score} / {total || "--"}
        </Text>
        <Text style={styles.muted}>Aproveitamento {accuracy}%</Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map(([value, label, count]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.chip, filter === value && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                filter === value && styles.chipTextActive,
              ]}
            >
              {label} ({count})
            </Text>
          </Pressable>
        ))}
      </View>

      {visible.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Nenhuma questao nesta visao.</Text>
        </View>
      ) : (
        visible.map((row) => {
          const isExpanded = Boolean(expanded[row.key]);
          return (
            <View key={row.key} style={styles.card}>
              <View style={styles.rowHeader}>
                <Text style={styles.cardTitle}>Questao {row.index + 1}</Text>
                <Text
                  style={
                    row.status === "correct" ? styles.correct : styles.wrong
                  }
                >
                  {row.status === "correct"
                    ? "Correta"
                    : row.status === "wrong"
                      ? "Incorreta"
                      : "Em branco"}
                </Text>
              </View>
              <Text
                numberOfLines={isExpanded ? undefined : 4}
                style={styles.question}
              >
                {stripHtml(
                  row.question.enunciado_clean || row.question.enunciado,
                )}
              </Text>
              <Text style={styles.muted}>
                Sua resposta: {answerLabel(row.selectedIndex)} · Gabarito:{" "}
                {answerLabel(row.correctIndex)}
              </Text>
              <Pressable
                onPress={() =>
                  setExpanded((old) => ({ ...old, [row.key]: !old[row.key] }))
                }
              >
                <Text style={styles.link}>
                  {isExpanded ? "Recolher alternativas" : "Ver alternativas"}
                </Text>
              </Pressable>
              {isExpanded ? (
                <View style={styles.options}>
                  {(row.question.itens || []).map((option, optionIndex) => (
                    <View
                      key={String(option.id ?? optionIndex)}
                      style={[
                        styles.option,
                        optionIndex === row.correctIndex &&
                          styles.optionCorrect,
                        optionIndex === row.selectedIndex &&
                          optionIndex !== row.correctIndex &&
                          styles.optionWrong,
                      ]}
                    >
                      <Text style={styles.optionLetter}>
                        {String.fromCharCode(65 + optionIndex)}
                      </Text>
                      <Text style={styles.optionText}>
                        {stripHtml(option.corpo_clean || option.corpo)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>Voltar para simulados</Text>
      </Pressable>
    </ScrollView>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: {
      gap: spacing[4],
      padding: spacing[4],
      paddingBottom: spacing[10],
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing[3],
      padding: spacing[6],
      backgroundColor: theme.background,
    },
    summary: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[2],
      padding: spacing[4],
    },
    eyebrow: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase",
    },
    title: {
      color: theme.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.extrabold,
    },
    score: {
      color: theme.primary,
      fontSize: typography.size["2xl"],
      fontWeight: typography.weight.black,
    },
    muted: { color: theme.textMuted, fontSize: typography.size.sm },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
    chip: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    chipActive: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
    },
    chipText: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    chipTextActive: { color: theme.primary },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[4],
    },
    rowHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing[2],
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.extrabold,
    },
    question: {
      color: theme.text,
      fontSize: typography.size.md,
      lineHeight: 23,
    },
    correct: {
      color: theme.success,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    wrong: {
      color: theme.danger,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    link: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    options: { gap: spacing[2] },
    option: {
      alignItems: "flex-start",
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      padding: spacing[3],
    },
    optionCorrect: {
      backgroundColor: theme.successSubtle,
      borderColor: theme.successBorder,
    },
    optionWrong: {
      backgroundColor: theme.dangerSubtle,
      borderColor: theme.dangerBorder,
    },
    optionLetter: {
      color: theme.text,
      fontWeight: typography.weight.extrabold,
    },
    optionText: { color: theme.text, flex: 1, fontSize: typography.size.sm },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    primaryText: { color: theme.onPrimary, fontWeight: typography.weight.bold },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    secondaryText: { color: theme.text, fontWeight: typography.weight.bold },
  });

export default SimulationDetailScreenV2;
