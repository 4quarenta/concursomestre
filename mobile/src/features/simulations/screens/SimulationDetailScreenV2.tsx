import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSimulationDetailQuery } from "@/features/simulations/api/useSimulationDetailQuery";
import {
  SimulationResultsScreen,
  type SimulationReviewRow,
} from "@/features/simulations/components/SimulationResultsScreen";
import { SimulationSubpageHeader } from "@/features/simulations/components/SimulationSubpageHeader";
import { spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import type { Question } from "@/types/questions";

const stripHtml = (value?: string) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const answerLabel = (value?: number) =>
  value === undefined || value < 0 ? undefined : String.fromCharCode(65 + value);

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

const metadataLabel = (value?: {
  nome?: string;
  sigla?: string;
  descricao?: string;
}) => String(value?.sigla || value?.nome || value?.descricao || "").trim();

const timestampMillis = (value?: number) => {
  if (!Number.isFinite(value) || Number(value) <= 0) return undefined;
  const numeric = Number(value);
  return numeric > 9999999999 ? numeric : numeric * 1000;
};

const difficultyLabel = (value?: unknown) => {
  const labels: Record<string, string> = {
    all: "Todas",
    easy: "Fácil",
    medium: "Média",
    hard: "Difícil",
  };
  return value == null ? undefined : labels[String(value)] || String(value);
};

export const SimulationDetailScreenV2: React.FC = () => {
  const params = useLocalSearchParams<{ simulationId?: string | string[] }>();
  const simulationId = Array.isArray(params.simulationId)
    ? params.simulationId[0]
    : params.simulationId || "";
  const query = useSimulationDetailQuery(simulationId);
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const goBack = React.useCallback(() => router.replace("/simulados"), []);

  if (query.isPending) {
    return (
      <View style={styles.screen}>
        <SimulationSubpageHeader title="Resultado do simulado" onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.screen}>
        <SimulationSubpageHeader title="Resultado do simulado" onBack={goBack} />
        <View style={styles.center}>
          <Text style={styles.title}>Resultado indisponível</Text>
          <Text style={styles.muted}>
            {query.error instanceof Error
              ? query.error.message
              : "Não foi possível carregar este simulado."}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => void query.refetch()}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const detail = query.data;
  const rows = (detail.questions || []).map((question, index) => {
    const key = questionKey(question, index);
    const raw = detail.answers?.[key];
    const selected =
      typeof raw === "object"
        ? Number(raw?.index ?? raw?.selectedOptionIndex ?? raw?.selected_option_index)
        : raw !== undefined
          ? Number(raw)
          : undefined;
    const selectedIndex =
      selected !== undefined && Number.isFinite(selected) && selected >= 0
        ? selected
        : undefined;
    const remoteCorrectIndex = typeof raw === "object"
      ? Number(raw?.correctOptionIndex ?? raw?.correct_option_index)
      : Number.NaN;
    const answer = Number.isFinite(remoteCorrectIndex) && remoteCorrectIndex >= 0
      ? remoteCorrectIndex
      : correctIndex(question);
    const remoteIsCorrect = typeof raw === "object"
      ? raw?.isCorrect ?? raw?.is_correct
      : undefined;
    const status = selectedIndex === undefined
      ? "blank" as const
      : typeof remoteIsCorrect === "boolean"
        ? remoteIsCorrect
          ? "correct" as const
          : "wrong" as const
        : selectedIndex === answer
        ? "correct" as const
        : "wrong" as const;
    const bank = metadataLabel(question.bancas?.[0]);
    const subject = metadataLabel(
      question.assuntos?.find((item) => item.materia),
    );
    const year = question.anos?.[0] ? String(question.anos[0]) : "";

    return {
      question,
      index,
      key,
      selectedIndex,
      correctIndex: answer,
      status,
      metadata: [bank, subject, year].filter(Boolean),
    };
  });

  const correct = rows.filter((row) => row.status === "correct").length;
  const wrong = rows.filter((row) => row.status === "wrong").length;
  const blank = rows.filter((row) => row.status === "blank").length;
  const total = rows.length || Number(detail.questionCount || 0);
  const score = Number(detail.score ?? correct);
  const displayedCorrect = rows.length > 0 ? correct : score;
  const percentage = total > 0
    ? Math.round(((rows.length > 0 ? correct : score) / total) * 100)
    : 0;
  const startTime = timestampMillis(detail.startTime);
  const endTime = timestampMillis(detail.endTime);
  const elapsedSeconds = startTime && endTime && endTime >= startTime
    ? Math.round((endTime - startTime) / 1000)
    : undefined;
  const reviewRows: SimulationReviewRow[] = rows.map((row) => ({
    id: row.key,
    questionNumber: row.index + 1,
    status: row.status,
    statement: stripHtml(
      row.question.enunciado_clean || row.question.enunciado,
    ),
    metadata: row.metadata,
    selectedAnswer: answerLabel(row.selectedIndex),
    correctAnswer: answerLabel(row.correctIndex),
  }));

  return (
    <SimulationResultsScreen
      title={detail.name || `Simulado ${detail.id}`}
      percentage={percentage}
      correct={displayedCorrect}
      total={total}
      wrong={wrong}
      blank={blank}
      elapsedSeconds={elapsedSeconds}
      secondsPerQuestion={elapsedSeconds !== undefined && total > 0 ? elapsedSeconds / total : undefined}
      difficulty={difficultyLabel(detail.config?.difficulty)}
      rows={reviewRows}
      onBack={goBack}
    />
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  center: { alignItems: "center", flex: 1, gap: spacing[3], justifyContent: "center", padding: spacing[6] },
  title: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold, textAlign: "center" },
  muted: { color: theme.textMuted, fontSize: typography.size.sm, textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: theme.primary, borderRadius: 12, justifyContent: "center", marginTop: spacing[2], minHeight: 46, paddingHorizontal: spacing[4] },
  retryText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});

export default SimulationDetailScreenV2;
