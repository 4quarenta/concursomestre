import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { simulationQueryKeys } from "@/features/simulations/api/queryKeys";
import { simulationsService } from "@/services/simulations/simulationsService";
import { useSimulationRunStore } from "@/state/simulationRunStore";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Question } from "@/types/questions";
import type { MobileSimulationResult } from "@/types/simulation";
import type { SimulationAnswerResult } from "@/types/simulations";

const stripHtml = (value?: string): string =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatRemainingTime = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

const questionKey = (question: Question, index: number): string =>
  String(question.id ?? `idx-${index}`);

const metadataLabel = (value?: {
  nome?: string;
  sigla?: string;
  descricao?: string;
}): string =>
  String(value?.sigla || value?.nome || value?.descricao || "").trim();

export const SimulationRunScreenV2: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const seed = useSimulationRunStore((state) => state.seed);
  const answers = useSimulationRunStore((state) => state.answers);
  const currentIndex = useSimulationRunStore((state) => state.currentIndex);
  const setAnswer = useSimulationRunStore((state) => state.setAnswer);
  const setCurrentIndex = useSimulationRunStore(
    (state) => state.setCurrentIndex,
  );
  const clearSeed = useSimulationRunStore((state) => state.clearSeed);
  const [hydrated, setHydrated] = React.useState(() =>
    useSimulationRunStore.persist.hasHydrated(),
  );
  const [serverResults, setServerResults] = React.useState<
    Record<string, SimulationAnswerResult>
  >({});
  const [result, setResult] = React.useState<MobileSimulationResult | null>(
    null,
  );
  const [finishing, setFinishing] = React.useState(false);
  const [savingAnswer, setSavingAnswer] = React.useState(false);
  const [showPalette, setShowPalette] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [showExitModal, setShowExitModal] = React.useState(false);
  const [showFinishModal, setShowFinishModal] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);

  React.useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useSimulationRunStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useSimulationRunStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);

  React.useEffect(() => {
    if (!seed?.config.timerEnabled || result) {
      setRemainingSeconds(0);
      return;
    }
    if (paused) return;

    const update = () => {
      const deadline = seed.startedAt + seed.config.timerMinutes * 60 * 1000;
      setRemainingSeconds(
        Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [paused, result, seed]);

  const simulationId = React.useMemo(
    () => seed?.id || (seed ? `sim-mobile-${seed.startedAt}` : ""),
    [seed],
  );
  const currentQuestion = seed?.questions[currentIndex];
  const currentKey = currentQuestion
    ? questionKey(currentQuestion, currentIndex)
    : "";
  const currentSelected = currentKey ? answers[currentKey] : undefined;
  const currentServerResult =
    currentQuestion?.id !== undefined
      ? serverResults[String(currentQuestion.id)]
      : undefined;
  const instantFeedback = seed?.config.feedbackMode === "instant";

  const buildPayload = React.useCallback(
    (status: "in_progress" | "completed", nextAnswers = answers) => {
      if (!seed) return null;
      const endTime = Date.now();
      return {
        id: simulationId,
        config: {
          ...seed.config,
          id: "mobile",
          name: "Simulado mobile",
          questionIds: seed.questions
            .map((question) => question.id)
            .filter(Boolean),
        },
        questions: seed.questions.map((question) => ({ id: question.id })),
        answers: Object.fromEntries(
          Object.entries(nextAnswers).map(([id, index]) => [
            id,
            { index, time_taken: 0 },
          ]),
        ),
        startTime: seed.startedAt,
        endTime,
        status,
      };
    },
    [answers, seed, simulationId],
  );

  const persistSnapshot = React.useCallback(
    async (status: "in_progress" | "completed", nextAnswers = answers) => {
      const payload = buildPayload(status, nextAnswers);
      if (!payload) throw new Error("Simulado ativo nao encontrado.");
      return simulationsService.saveSimulation(payload);
    },
    [answers, buildPayload],
  );

  const finish = React.useCallback(async () => {
    if (!seed || finishing || result) return;

    setFinishing(true);
    try {
      const saved = await persistSnapshot("completed");
      const authoritative = saved.results;
      setServerResults(authoritative);

      const questionResults = seed.questions.map((question, index) => {
        const key = questionKey(question, index);
        const selectedIndex = answers[key];
        const server =
          question.id !== undefined
            ? authoritative[String(question.id)]
            : undefined;
        return {
          question: server
            ? {
                ...question,
                correctOptionIndex: server.correctOptionIndex,
                userAnswer: {
                  questionId: question.id,
                  selectedOptionIndex: server.selectedOptionIndex,
                  isCorrect: server.isCorrect,
                  timestamp: Date.now(),
                },
              }
            : question,
          selectedIndex,
          answered: selectedIndex !== undefined,
          isCorrect: Boolean(server?.isCorrect),
          correctIndex: server?.correctOptionIndex ?? -1,
        };
      });

      setResult({
        score: saved.score,
        total: seed.questions.length,
        elapsedSeconds: Math.max(
          0,
          Math.round((Date.now() - seed.startedAt) / 1000),
        ),
        questionResults,
      });
      clearSeed();
      await queryClient.invalidateQueries({
        queryKey: simulationQueryKeys.all,
      });
    } catch (error: any) {
      Alert.alert(
        "Simulado",
        error?.message || "Nao foi possivel finalizar o simulado.",
      );
    } finally {
      setFinishing(false);
    }
  }, [
    answers,
    clearSeed,
    finishing,
    persistSnapshot,
    queryClient,
    result,
    seed,
  ]);

  React.useEffect(() => {
    if (!seed?.config.timerEnabled || result || finishing) return;
    if (
      remainingSeconds === 0 &&
      Date.now() > seed.startedAt + seed.config.timerMinutes * 60 * 1000
    ) {
      void finish();
    }
  }, [finish, finishing, remainingSeconds, result, seed]);

  const selectOption = React.useCallback(
    async (optionIndex: number) => {
      if (!currentQuestion || !seed) return;
      if (instantFeedback && currentServerResult) return;

      const key = questionKey(currentQuestion, currentIndex);
      const nextAnswers = { ...answers, [key]: optionIndex };
      setAnswer(key, optionIndex);

      if (!instantFeedback || currentQuestion.id === undefined) return;

      setSavingAnswer(true);
      try {
        const saved = await persistSnapshot("in_progress", nextAnswers);
        setServerResults(saved.results);
        await queryClient.invalidateQueries({
          queryKey: simulationQueryKeys.all,
        });
      } catch (error: any) {
        Alert.alert(
          "Simulado",
          error?.message || "Nao foi possivel validar esta resposta.",
        );
      } finally {
        setSavingAnswer(false);
      }
    },
    [
      answers,
      currentIndex,
      currentQuestion,
      currentServerResult,
      instantFeedback,
      persistSnapshot,
      queryClient,
      seed,
      setAnswer,
    ],
  );

  const requestFinish = () => setShowFinishModal(true);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const resultCorrect =
    result?.questionResults.filter((entry) => entry.isCorrect).length || 0;
  const resultWrong =
    result?.questionResults.filter(
      (entry) => entry.answered && !entry.isCorrect,
    ).length || 0;
  const resultBlank =
    result?.questionResults.filter((entry) => !entry.answered).length || 0;

  if (result) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: spacing[4],
            paddingBottom: spacing[10] + insets.bottom,
          },
        ]}
      >
        <View style={styles.resultHero}>
          <Text style={styles.resultEyebrow}>RESULTADO DO SIMULADO</Text>
          <Text style={styles.resultTitle}>Seu desempenho</Text>
          <Text style={styles.resultScore}>
            {result.score} / {result.total}
          </Text>
          <Text style={styles.resultHint}>
            Pontuação calculada pelo servidor
          </Text>
        </View>

        <View style={styles.resultStats}>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{resultCorrect}</Text>
            <Text style={styles.resultStatLabel}>Acertos</Text>
          </View>
          <View style={styles.resultStat}>
            <Text style={[styles.resultStatValue, styles.resultWrongValue]}>
              {resultWrong}
            </Text>
            <Text style={styles.resultStatLabel}>Erros</Text>
          </View>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{resultBlank}</Text>
            <Text style={styles.resultStatLabel}>Em branco</Text>
          </View>
        </View>

        {result.questionResults.map((entry, index) => (
          <View
            key={questionKey(entry.question, index)}
            style={styles.reviewCard}
          >
            <Text
              style={entry.isCorrect ? styles.correctText : styles.wrongText}
            >
              {entry.answered
                ? entry.isCorrect
                  ? "Acerto"
                  : "Erro"
                : "Em branco"}
            </Text>
            <Text style={styles.statement}>
              {stripHtml(
                entry.question.enunciado_clean || entry.question.enunciado,
              )}
            </Text>
            <Text style={styles.muted}>
              Sua resposta:{" "}
              {entry.selectedIndex === undefined
                ? "--"
                : String.fromCharCode(65 + entry.selectedIndex)}{" "}
              · Gabarito:{" "}
              {entry.correctIndex < 0
                ? "--"
                : String.fromCharCode(65 + entry.correctIndex)}
            </Text>
          </View>
        ))}

        <Pressable
          onPress={() => router.replace("/simulados")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Voltar aos simulados</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!seed || !currentQuestion) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nenhum simulado ativo</Text>
        <Text style={styles.muted}>Crie um novo simulado para iniciar.</Text>
        <Pressable
          onPress={() => router.replace("/simulados/novo")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Novo simulado</Text>
        </Pressable>
      </View>
    );
  }

  const metadata = [
    ["Banca", metadataLabel(currentQuestion.bancas?.[0])],
    ["Ano", currentQuestion.anos?.[0] ? String(currentQuestion.anos[0]) : ""],
    ["Órgão", metadataLabel(currentQuestion.orgaos?.[0])],
    ["Cargo", metadataLabel(currentQuestion.cargos?.[0])],
    ["Matéria", metadataLabel(currentQuestion.assuntos?.find((item) => item.materia))],
    ["Assunto", metadataLabel(currentQuestion.assuntos?.find((item) => !item.materia))],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  const goPrevious = () =>
    setCurrentIndex(Math.max(0, currentIndex - 1));
  const goNext = () => {
    if (currentIndex < seed.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    requestFinish();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: spacing[2] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair do simulado"
          onPress={() => setShowExitModal(true)}
          style={styles.iconButton}
        >
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.timerPill}>
          <Ionicons name="time-outline" size={16} color={theme.primary} />
          <Text style={styles.timer}>
            {seed.config.timerEnabled ? formatRemainingTime(remainingSeconds) : "Sem limite"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? "Continuar simulado" : "Pausar simulado"}
          onPress={() => setPaused((value) => !value)}
          style={styles.iconButton}
        >
          <Ionicons name={paused ? "play" : "pause"} size={20} color={theme.textMuted} />
        </Pressable>
      </View>
      <View style={styles.runMetaRow}>
        <Text style={styles.topEyebrow}>
          Questão {currentIndex + 1} de {seed.questions.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Navegar pelas questões"
          onPress={() => setShowPalette((value) => !value)}
          style={styles.paletteButton}
        >
          <Ionicons name={showPalette ? "close" : "grid-outline"} size={17} color={theme.textMuted} />
          <Text style={styles.paletteButtonText}>Questões</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / seed.questions.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 104 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showPalette ? (
          <View style={styles.palette}>
            {seed.questions.map((question, index) => {
              const key = questionKey(question, index);
              const answered = answers[key] !== undefined;
              const active = index === currentIndex;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setCurrentIndex(index);
                    setShowPalette(false);
                  }}
                  style={[
                    styles.paletteItem,
                    answered && styles.paletteAnswered,
                    active && styles.paletteActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.paletteText,
                      (answered || active) && styles.paletteTextActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoEyebrow}>INFORMAÇÕES DA QUESTÃO</Text>
            <Text style={styles.infoId}>#{currentQuestion.id ?? currentIndex + 1}</Text>
          </View>
          <View style={styles.chips}>
            {metadata.map(([name, value]) => (
              <View
                key={`${name}-${value}`}
                style={[styles.chip, (name === "Matéria" || name === "Assunto") && styles.primaryChip]}
              >
                <Text style={styles.chipLabel}>{name}: </Text>
                <Text style={styles.chipValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.statement}>
          {stripHtml(currentQuestion.enunciado_clean || currentQuestion.enunciado) ||
            "Questão sem enunciado."}
        </Text>

        <View style={styles.options}>
          {(currentQuestion.itens || []).map((option, optionIndex) => {
            const selected = currentSelected === optionIndex;
            const correct = currentServerResult?.correctOptionIndex === optionIndex;
            const wrong = selected && currentServerResult?.isCorrect === false;
            return (
              <Pressable
                key={String(option.id ?? optionIndex)}
                disabled={savingAnswer || (instantFeedback && Boolean(currentServerResult))}
                onPress={() => void selectOption(optionIndex)}
                style={[
                  styles.option,
                  selected && !currentServerResult && styles.optionSelected,
                  correct && styles.optionCorrect,
                  wrong && styles.optionWrong,
                  instantFeedback && currentServerResult && !correct && !wrong && styles.optionFaded,
                ]}
              >
                <View
                  style={[
                    styles.letter,
                    selected && !currentServerResult && styles.letterSelected,
                    correct && styles.letterCorrect,
                    wrong && styles.letterWrong,
                  ]}
                >
                  {correct ? (
                    <Ionicons name="checkmark" size={15} color={theme.onPrimary} />
                  ) : wrong ? (
                    <Ionicons name="close" size={15} color={theme.onPrimary} />
                  ) : (
                    <Text style={[styles.letterText, selected && !currentServerResult && styles.letterTextSelected]}>
                      {String.fromCharCode(65 + optionIndex)}
                    </Text>
                  )}
                </View>
                <Text style={styles.optionText}>
                  {stripHtml(option.corpo_clean || option.corpo) || `Alternativa ${optionIndex + 1}`}
                </Text>
                {savingAnswer && selected ? <ActivityIndicator size="small" color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {instantFeedback && currentServerResult ? (
          <View style={styles.feedbackBanner}>
            <Ionicons
              name={currentServerResult.isCorrect ? "checkmark-circle" : "close-circle"}
              size={20}
              color={currentServerResult.isCorrect ? theme.success : theme.danger}
            />
            <Text style={currentServerResult.isCorrect ? styles.correctText : styles.wrongText}>
              {currentServerResult.isCorrect
                ? "Resposta correta."
                : `Resposta incorreta. Gabarito ${String.fromCharCode(65 + currentServerResult.correctOptionIndex)}.`}
            </Text>
          </View>
        ) : null}

        <Pressable onPress={requestFinish} style={styles.finishLink}>
          <Text style={styles.finishLinkText}>Finalizar simulado</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[3] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Questão anterior"
          disabled={currentIndex === 0}
          onPress={goPrevious}
          style={[styles.arrowButton, currentIndex === 0 && styles.disabled]}
        >
          <Ionicons name="arrow-back" size={21} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={goNext}
          style={[styles.primaryButton, styles.bottomPrimaryButton]}
        >
          <Text style={styles.primaryButtonText}>
            {currentIndex < seed.questions.length - 1
              ? "Próxima questão"
              : finishing
                ? "Finalizando..."
                : "Finalizar simulado"}
          </Text>
          {currentIndex < seed.questions.length - 1 ? (
            <Ionicons name="arrow-forward" size={17} color={theme.onPrimary} />
          ) : null}
        </Pressable>
      </View>

      <SimulationConfirmModal
        visible={showExitModal}
        title="Sair do simulado?"
        message="Seu progresso será perdido. Tem certeza?"
        cancelLabel="Continuar"
        confirmLabel="Sair"
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => {
          setShowExitModal(false);
          clearSeed();
          router.replace("/simulados");
        }}
      />
      <SimulationConfirmModal
        visible={showFinishModal}
        title="Finalizar simulado?"
        message="Respostas em branco serão mantidas como não respondidas."
        cancelLabel="Voltar"
        confirmLabel="Finalizar"
        onCancel={() => setShowFinishModal(false)}
        onConfirm={() => {
          setShowFinishModal(false);
          void finish();
        }}
      />
    </View>
  );
};

const SimulationConfirmModal = ({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.modalConfirmButton}>
              <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: { backgroundColor: theme.background, flex: 1 },
    content: {
      gap: spacing[4],
      padding: spacing[4],
      paddingBottom: spacing[10],
    },
    topBar: {
      alignItems: "center",
      backgroundColor: theme.surface,
      flexDirection: "row",
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
    },
    topEyebrow: { color: theme.textMuted, fontSize: 10 },
    topMeta: {
      color: theme.text,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      marginTop: 2,
    },
    runMetaRow: {
      alignItems: "center",
      backgroundColor: theme.surface,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: spacing[2],
      paddingHorizontal: spacing[4],
    },
    paletteButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    paletteButtonText: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    iconButton: {
      alignItems: "center",
      borderRadius: radius.pill,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    timerPill: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing[1],
      minHeight: 34,
      paddingHorizontal: spacing[2],
    },
    center: {
      alignItems: "center",
      backgroundColor: theme.background,
      flex: 1,
      gap: spacing[3],
      justifyContent: "center",
      padding: spacing[6],
    },
    topRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    timer: {
      color: theme.primary,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
    },
    progressTrack: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      height: 4,
      overflow: "hidden",
    },
    progressFill: { backgroundColor: theme.primary, height: "100%" },
    palette: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
    paletteItem: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    paletteAnswered: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
    },
    paletteActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    paletteText: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    paletteTextActive: { color: theme.onPrimary },
    infoCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing[3],
    },
    infoHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing[2],
    },
    infoEyebrow: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: typography.weight.bold,
      letterSpacing: 0.6,
    },
    infoId: { color: theme.textMuted, fontSize: 10 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
    chip: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      flexDirection: "row",
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    primaryChip: { backgroundColor: theme.primarySubtle },
    chipLabel: { color: theme.textMuted, fontSize: 10 },
    chipValue: {
      color: theme.text,
      fontSize: 10,
      fontWeight: typography.weight.semibold,
    },
    statement: {
      color: theme.text,
      fontSize: typography.size.md,
      lineHeight: 24,
    },
    options: { gap: spacing[3] },
    option: {
      alignItems: "flex-start",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 2,
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[4],
    },
    optionSelected: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
    },
    optionCorrect: {
      backgroundColor: theme.successSubtle,
      borderColor: theme.success,
    },
    optionWrong: {
      backgroundColor: theme.dangerSubtle,
      borderColor: theme.danger,
    },
    optionFaded: { opacity: 0.55 },
    letter: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    letterSelected: { backgroundColor: theme.primary },
    letterCorrect: { backgroundColor: theme.success },
    letterWrong: { backgroundColor: theme.danger },
    letterText: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    letterTextSelected: { color: theme.onPrimary },
    optionText: {
      color: theme.text,
      flex: 1,
      fontSize: typography.size.sm,
      lineHeight: 20,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing[4],
    },
    primaryButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    bottomBar: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
    },
    bottomPrimaryButton: {
      flex: 1,
      flexDirection: "row",
      gap: spacing[2],
    },
    arrowButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    disabled: { opacity: 0.4 },
    finishLink: { alignItems: "center", paddingVertical: spacing[2] },
    finishLinkText: {
      color: theme.danger,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    feedbackBanner: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      padding: spacing[3],
    },
    correctText: {
      color: theme.success,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    wrongText: {
      color: theme.danger,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    resultHero: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      gap: spacing[2],
      padding: spacing[6],
    },
    resultEyebrow: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 10,
      fontWeight: typography.weight.bold,
      letterSpacing: 1,
    },
    resultTitle: {
      color: theme.onPrimary,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.bold,
    },
    resultScore: {
      color: theme.onPrimary,
      fontSize: typography.size["3xl"],
      fontWeight: typography.weight.black,
    },
    resultHint: {
      color: "rgba(255,255,255,0.78)",
      fontSize: typography.size.xs,
    },
    resultStats: { flexDirection: "row", gap: spacing[2] },
    resultStat: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      padding: spacing[3],
    },
    resultStatValue: {
      color: theme.success,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.bold,
    },
    resultWrongValue: { color: theme.danger },
    resultStatLabel: { color: theme.textMuted, fontSize: 10 },
    reviewCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[2],
      padding: spacing[4],
    },
    muted: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      textAlign: "center",
    },
    emptyTitle: {
      color: theme.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.extrabold,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(15,23,42,0.45)",
      flex: 1,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      gap: spacing[2],
      padding: spacing[6],
      width: "100%",
    },
    modalTitle: {
      color: theme.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    modalMessage: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing[2],
      marginTop: spacing[3],
    },
    modalCancelButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing[3],
    },
    modalCancelText: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    modalConfirmButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing[3],
    },
    modalConfirmText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
  });

export default SimulationRunScreenV2;
