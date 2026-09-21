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
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuestionCard } from "@/features/questions/components/QuestionCard";
import { QuestionDetailsPanel } from "@/features/questions/components/QuestionDetailsPanel";
import {
  QuestionsFilters,
  type AdvancedQuestionFilterValues,
  type DifficultyGroup,
} from "@/features/questions/components/QuestionsFilters";
import { questionQueryKeys } from "@/features/questions/api/queryKeys";
import { useAnswerQuestionMutation } from "@/features/questions/api/useAnswerQuestionMutation";
import { useInfiniteQuestionsQuery } from "@/features/questions/api/useInfiniteQuestionsQuery";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import { useAuth } from "@/providers/AuthProvider";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import type { Question, QuestionListFilters } from "@/types/questions";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
type ViewMode = "list" | "focus";

const difficultyToApi: Record<DifficultyGroup, string[] | undefined> = {
  all: undefined,
  easy: ["Muito facil", "Facil"],
  medium: ["Medio"],
  hard: ["Dificil", "Muito dificil"],
};

const paramValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const paramList = (value: string | string[] | undefined): string[] => {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const paramListOrUndefined = (
  value: string | string[] | undefined,
): string[] | undefined => {
  const values = paramList(value);
  return values.length > 0 ? values : undefined;
};

const difficultyValuesToApi = (values: string[]): string[] =>
  values.flatMap((value) => {
    if (value === "easy") return ["Muito facil", "Facil"];
    if (value === "medium") return ["Medio"];
    if (value === "hard") return ["Dificil", "Muito dificil"];
    return [];
  });

/**
 * Implementacao F3 da pratica mobile.
 * Usa filtros/paginacao no servidor e TanStack Query em vez de baixar todo o banco.
 * A tela legada permanece no repositorio somente para rollback controlado.
 */
export const QuestionsScreenV2: React.FC = () => {
  const params = useLocalSearchParams<{
    bancas?: string | string[];
    anos?: string | string[];
    materias?: string | string[];
    dificuldades?: string | string[];
    qtd?: string | string[];
  }>();
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, refreshProfile, toggleSavedQuestion } = useAuth();
  const [keywordInput, setKeywordInput] = React.useState("");
  const [debouncedKeyword, setDebouncedKeyword] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<DifficultyGroup>("all");
  const [onlySaved, setOnlySaved] = React.useState(false);
  const [excludeAnswered, setExcludeAnswered] = React.useState(false);
  const [advanced, setAdvanced] = React.useState<AdvancedQuestionFilterValues>(
    () => ({
      agency: paramListOrUndefined(params.bancas),
      year: paramListOrUndefined(params.anos),
      subject: paramListOrUndefined(params.materias),
    }),
  );
  const [routeDifficultyFilters, setRouteDifficultyFilters] = React.useState<
    string[]
  >(() => paramList(params.dificuldades));
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [focusIndex, setFocusIndex] = React.useState(0);

  const pageSize = React.useMemo(() => {
    const requested = Number(paramValue(params.qtd));
    return Number.isFinite(requested) && requested >= 10 && requested <= 100
      ? requested
      : PAGE_SIZE;
  }, [params.qtd]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [keywordInput]);

  const filters = React.useMemo<QuestionListFilters>(
    () => ({
      keyword: debouncedKeyword || undefined,
      difficulty:
        routeDifficultyFilters.length > 0
          ? difficultyValuesToApi(routeDifficultyFilters)
          : difficultyToApi[difficulty],
      subject: advanced.subject,
      topic: advanced.topic,
      agency: advanced.agency,
      organization: advanced.organization,
      role: advanced.role,
      year: advanced.year,
      onlySaved: onlySaved || undefined,
      excludeAnswered: excludeAnswered || undefined,
      excludeCanceled: true,
      excludeOutdated: true,
    }),
    [
      advanced,
      debouncedKeyword,
      difficulty,
      excludeAnswered,
      onlySaved,
      routeDifficultyFilters,
    ],
  );

  React.useEffect(() => {
    setFocusIndex(0);
  }, [filters]);

  const taxonomiesQuery = useQuestionTaxonomiesQuery();
  const questionsQuery = useInfiniteQuestionsQuery(filters, pageSize);
  const answerMutation = useAnswerQuestionMutation(user?.id);
  const savedQuestionIds = React.useMemo(
    () => new Set((user?.savedQuestionIds || []).map(String)),
    [user?.savedQuestionIds],
  );
  const displayedQuestions = React.useMemo(
    () =>
      viewMode === "focus"
        ? questionsQuery.questions.slice(focusIndex, focusIndex + 1)
        : questionsQuery.questions,
    [focusIndex, questionsQuery.questions, viewMode],
  );

  const handleClearFilters = React.useCallback(() => {
    setKeywordInput("");
    setDebouncedKeyword("");
    setDifficulty("all");
    setOnlySaved(false);
    setExcludeAnswered(false);
    setAdvanced({});
    setRouteDifficultyFilters([]);
    setFocusIndex(0);
  }, []);

  const handleAnswer = React.useCallback(
    async (question: Question, optionIndex: number) => {
      if (!question.id) {
        Alert.alert(
          "Questao indisponivel",
          "Nao foi possivel identificar esta questao.",
        );
        return;
      }

      try {
        const { result } = await answerMutation.mutateAsync({
          questionId: question.id,
          selectedOptionIndex: optionIndex,
        });

        if (result.newXp !== undefined || result.newLevel !== undefined) {
          await refreshProfile();
        }
      } catch (error: any) {
        Alert.alert(
          "Erro ao responder",
          error?.message || "Nao foi possivel registrar a resposta.",
        );
      }
    },
    [answerMutation, refreshProfile],
  );

  const handleToggleSaved = React.useCallback(
    async (question: Question) => {
      if (!question.id) return;

      try {
        await toggleSavedQuestion(question.id);
        await queryClient.invalidateQueries({
          queryKey: questionQueryKeys.lists(),
        });
      } catch (error: any) {
        Alert.alert(
          "Erro",
          error?.message || "Nao foi possivel atualizar as questoes salvas.",
        );
      }
    },
    [queryClient, toggleSavedQuestion],
  );

  const handleEndReached = React.useCallback(() => {
    if (
      viewMode === "list" &&
      questionsQuery.hasNextPage &&
      !questionsQuery.isFetchingNextPage
    ) {
      void questionsQuery.fetchNextPage();
    }
  }, [questionsQuery, viewMode]);

  const handleFocusPrevious = React.useCallback(() => {
    setFocusIndex((current) => Math.max(0, current - 1));
  }, []);

  const handleFocusNext = React.useCallback(async () => {
    const nextIndex = focusIndex + 1;
    if (nextIndex < questionsQuery.questions.length) {
      setFocusIndex(nextIndex);
      return;
    }

    if (!questionsQuery.hasNextPage || questionsQuery.isFetchingNextPage) {
      return;
    }

    const result = await questionsQuery.fetchNextPage();
    const loadedCount =
      result.data?.pages.reduce((total, page) => total + page.rows.length, 0) ||
      0;
    if (nextIndex < loadedCount) {
      setFocusIndex(nextIndex);
    }
  }, [focusIndex, questionsQuery]);

  const handleRetryQuestions = React.useCallback(() => {
    void questionsQuery.refetch();
  }, [questionsQuery]);

  const handleRetryTaxonomies = React.useCallback(() => {
    void taxonomiesQuery.refetch();
  }, [taxonomiesQuery]);

  const renderQuestion = React.useCallback(
    ({ item }: { item: Question }) => {
      const pendingVariables = answerMutation.isPending
        ? answerMutation.variables
        : undefined;
      const answeringOptionIndex =
        pendingVariables && pendingVariables.questionId === item.id
          ? pendingVariables.selectedOptionIndex
          : undefined;

      if (viewMode === "list") {
        const index = questionsQuery.questions.findIndex(
          (question) => question.id === item.id,
        );
        const subject = item.assuntos?.[0]?.nome || "Prática geral";
        const agency =
          item.bancas?.[0]?.sigla ||
          item.bancas?.[0]?.nome ||
          "Banca não informada";
        const year = item.anos?.[0] ? String(item.anos[0]) : "--";
        const difficultyLabel =
          item.dificuldade !== undefined
            ? item.dificuldade >= 3
              ? "Difícil"
              : item.dificuldade === 2
                ? "Médio"
                : "Fácil"
            : "Não classificada";
        const difficultyStyle =
          item.dificuldade !== undefined && item.dificuldade >= 3
            ? styles.listDifficultyHard
            : item.dificuldade === 2
              ? styles.listDifficultyMedium
              : styles.listDifficultyEasy;
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              item.id
                ? router.push(`/questao/${item.id}`)
                : (() => {
                    setFocusIndex(Math.max(0, index));
                    setViewMode("focus");
                  })()
            }
            style={({ pressed }) => [
              styles.listRow,
              pressed && styles.listRowPressed,
            ]}
          >
            <View style={styles.listIndex}>
              <Text style={styles.listIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.listCopy}>
              <Text numberOfLines={2} style={styles.listTopic}>
                {item.enunciado_clean ||
                  item.enunciado ||
                  "Questão sem enunciado"}
              </Text>
              <Text numberOfLines={1} style={styles.listMeta}>
                {agency} · {year} · {subject}
              </Text>
            </View>
            <View style={styles.listTrailing}>
              <Text style={[styles.listDifficulty, difficultyStyle]}>
                {difficultyLabel}
              </Text>
              <Text style={styles.listChevron}>›</Text>
            </View>
          </Pressable>
        );
      }

      return (
        <View>
          <QuestionCard
            answeringOptionIndex={answeringOptionIndex}
            isSaved={
              item.id !== undefined && savedQuestionIds.has(String(item.id))
            }
            onAnswer={(question, optionIndex) =>
              void handleAnswer(question, optionIndex)
            }
            onToggleSaved={(question) => void handleToggleSaved(question)}
            question={item}
          />
          <QuestionDetailsPanel
            question={item}
            userId={user?.id}
            userName={user?.name}
          />
        </View>
      );
    },
    [
      answerMutation.isPending,
      answerMutation.variables,
      handleAnswer,
      handleToggleSaved,
      savedQuestionIds,
      questionsQuery.questions,
      user?.id,
      user?.name,
      viewMode,
    ],
  );

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: spacing[4],
          paddingBottom: spacing[8] + insets.bottom + 64,
        },
      ]}
      data={displayedQuestions}
      keyExtractor={(item, index) => String(item.id ?? `question-${index}`)}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={
            questionsQuery.isRefetching && !questionsQuery.isFetchingNextPage
          }
          onRefresh={() => void questionsQuery.refetch()}
          tintColor={theme.primary}
        />
      }
      renderItem={renderQuestion}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Questoes</Text>
            <Text style={styles.subtitle}>
              {questionsQuery.total > 0
                ? `${questionsQuery.total} questoes encontradas`
                : "Pratica conectada ao banco oficial"}
            </Text>
          </View>

          <View style={styles.modeSelector}>
            {(["list", "focus"] as ViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => setViewMode(mode)}
                  style={[styles.modeButton, active && styles.modeButtonActive]}
                >
                  <Text
                    style={[styles.modeText, active && styles.modeTextActive]}
                  >
                    {mode === "list" ? "Lista" : "Foco"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <QuestionsFilters
            advanced={advanced}
            difficulty={difficulty}
            excludeAnswered={excludeAnswered}
            keyword={keywordInput}
            onAdvancedChange={setAdvanced}
            onClear={handleClearFilters}
            onDifficultyChange={setDifficulty}
            onExcludeAnsweredChange={setExcludeAnswered}
            onKeywordChange={setKeywordInput}
            onOnlySavedChange={setOnlySaved}
            onlySaved={onlySaved}
            taxonomies={taxonomiesQuery.data}
            taxonomiesLoading={taxonomiesQuery.isLoading}
          />

          {taxonomiesQuery.isError ? (
            <View style={styles.inlineError}>
              <Text style={styles.taxonomyWarning}>
                Os filtros avancados nao puderam ser carregados. Busca e filtros
                basicos continuam disponiveis.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleRetryTaxonomies}
                style={styles.retryGhost}
              >
                <Text style={styles.retryGhostText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}

          {questionsQuery.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.stateText}>Carregando questoes...</Text>
            </View>
          ) : null}

          {questionsQuery.isError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>
                Nao foi possivel carregar as questoes.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleRetryQuestions}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !questionsQuery.isLoading && !questionsQuery.isError ? (
          <Text style={styles.emptyText}>
            Nenhuma questao encontrada com estes filtros.
          </Text>
        ) : null
      }
      ListFooterComponent={
        viewMode === "focus" && displayedQuestions.length > 0 ? (
          <View style={styles.focusFooter}>
            <Text style={styles.focusCounter}>
              Questao {focusIndex + 1} de{" "}
              {questionsQuery.total || questionsQuery.questions.length}
            </Text>
            <View style={styles.focusActions}>
              <Pressable
                disabled={focusIndex === 0}
                onPress={handleFocusPrevious}
                style={[
                  styles.focusButton,
                  focusIndex === 0 && styles.disabledButton,
                ]}
              >
                <Text style={styles.focusButtonText}>Anterior</Text>
              </Pressable>
              <Pressable
                disabled={
                  !questionsQuery.hasNextPage &&
                  focusIndex >= questionsQuery.questions.length - 1
                }
                onPress={() => void handleFocusNext()}
                style={styles.focusButtonPrimary}
              >
                {questionsQuery.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <Text style={styles.focusButtonPrimaryText}>Proxima</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : questionsQuery.isFetchingNextPage ? (
          <ActivityIndicator
            style={styles.footerLoader}
            color={theme.primary}
          />
        ) : (
          <View style={styles.footerSpace} />
        )
      }
    />
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    content: {
      backgroundColor: theme.background,
      flexGrow: 1,
      padding: spacing[4],
    },
    header: {
      gap: spacing[5],
      marginBottom: spacing[5],
    },
    titleBlock: {
      gap: spacing[1],
    },
    title: {
      color: theme.text,
      fontSize: typography.size["2xl"],
      fontWeight: typography.weight.extrabold,
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
    },
    modeSelector: {
      alignSelf: "flex-start",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.pill,
      flexDirection: "row",
      padding: spacing[1],
    },
    modeButton: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    modeButtonActive: {
      backgroundColor: theme.surface,
    },
    modeText: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    modeTextActive: {
      color: theme.primary,
    },
    inlineError: {
      alignItems: "flex-start",
      gap: spacing[2],
    },
    taxonomyWarning: {
      color: theme.warning,
      fontSize: typography.size.xs,
      lineHeight: 18,
    },
    separator: {
      height: spacing[5],
    },
    listRow: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[4],
      shadowColor: theme.text,
      shadowOpacity: 0.04,
      shadowRadius: 5,
    },
    listRowPressed: { opacity: 0.75 },
    listIndex: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    listIndexText: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    listCopy: { flex: 1, gap: spacing[1] },
    listTopic: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      lineHeight: 20,
    },
    listMeta: { color: theme.textMuted, fontSize: 11 },
    listTrailing: { alignItems: "flex-end", gap: spacing[2] },
    listDifficulty: {
      borderRadius: radius.pill,
      fontSize: 10,
      fontWeight: typography.weight.bold,
      overflow: "hidden",
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
    },
    listDifficultyEasy: {
      backgroundColor: theme.successSubtle,
      color: theme.success,
    },
    listDifficultyMedium: {
      backgroundColor: theme.warningSubtle,
      color: theme.warning,
    },
    listDifficultyHard: {
      backgroundColor: theme.dangerSubtle,
      color: theme.danger,
    },
    listChevron: { color: theme.textMuted, fontSize: 24, lineHeight: 20 },
    centerState: {
      alignItems: "center",
      gap: spacing[3],
      paddingVertical: spacing[6],
    },
    stateText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
    },
    errorText: {
      color: theme.danger,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      textAlign: "center",
    },
    retryButton: {
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: spacing[4],
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    retryGhost: {
      paddingVertical: spacing[1],
    },
    retryGhostText: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      paddingVertical: spacing[8],
      textAlign: "center",
    },
    focusFooter: {
      gap: spacing[3],
      paddingVertical: spacing[6],
    },
    focusCounter: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      textAlign: "center",
    },
    focusActions: {
      flexDirection: "row",
      gap: spacing[3],
    },
    focusButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
    },
    focusButtonText: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    focusButtonPrimary: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
    },
    focusButtonPrimaryText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    disabledButton: {
      opacity: 0.45,
    },
    footerLoader: {
      marginVertical: spacing[6],
    },
    footerSpace: {
      height: spacing[8],
    },
  });

export default QuestionsScreenV2;
