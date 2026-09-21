import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { questionQueryKeys } from "@/features/questions/api/queryKeys";
import { useAnswerQuestionMutation } from "@/features/questions/api/useAnswerQuestionMutation";
import { useQuestionCommentsQuery } from "@/features/questions/api/useQuestionDetailsQueries";
import {
  useAddQuestionCommentMutation,
  useLikeQuestionCommentMutation,
} from "@/features/questions/api/useQuestionCommentsMutations";
import { QuestionCommentsPanel } from "@/components/questions/QuestionCommentsPanel";
import { questionService } from "@/services/questions/questionService";
import { useAuth } from "@/providers/AuthProvider";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import type { Question, QuestionListFilters } from "@/types/questions";

type DetailTab = "explanation" | "teacher" | "stats" | "comments";
type NavigationDirection = "next" | "previous";
type Theme = ReturnType<typeof useAppTheme>;

const clean = (value?: string | null): string =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const label = (value?: {
  nome?: string;
  sigla?: string;
  descricao?: string;
  ["descrição"]?: string;
}): string =>
  String(
    value?.sigla ||
      value?.nome ||
      value?.descricao ||
      value?.["descrição"] ||
      "",
  ).trim();
const resolveCorrect = (question: Question): number | undefined => {
  if (Number.isInteger(question.correctOptionIndex))
    return question.correctOptionIndex;
  if (Number.isInteger(question.resposta))
    return Number(question.resposta) > 0
      ? Number(question.resposta) - 1
      : Number(question.resposta);
  return undefined;
};

const paramValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const paramList = (value: string | string[] | undefined): string[] =>
  paramValue(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function QuestionViewScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, toggleSavedQuestion } = useAuth();
  const queryClient = useQueryClient();
  const {
    id,
    flow,
    palavraChave,
    bancas,
    anos,
    materias,
    assuntos,
    orgaos,
    cargos,
    focos,
    niveis,
    modalidades,
    dificuldades,
    apenasSalvas,
    comentarioProfessor,
    analiseDetalhada,
    excluirAnuladas,
    excluirDesatualizadas,
    naoRespondidas,
  } =
    useLocalSearchParams<{
      id?: string | string[];
      flow?: string | string[];
      palavraChave?: string | string[];
      bancas?: string | string[];
      anos?: string | string[];
      materias?: string | string[];
      assuntos?: string | string[];
      orgaos?: string | string[];
      cargos?: string | string[];
      focos?: string | string[];
      niveis?: string | string[];
      modalidades?: string | string[];
      dificuldades?: string | string[];
      apenasSalvas?: string | string[];
      comentarioProfessor?: string | string[];
      analiseDetalhada?: string | string[];
      excluirAnuladas?: string | string[];
      excluirDesatualizadas?: string | string[];
      naoRespondidas?: string | string[];
    }>();
  const questionId = Number(Array.isArray(id) ? id[0] : id);
  const flowParam = paramValue(flow);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [activeQuestionId, setActiveQuestionId] = React.useState(questionId);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [answeredQuestion, setAnsweredQuestion] =
    React.useState<Question | null>(null);
  const [pageTarget, setPageTarget] = React.useState<"first" | "last" | null>(
    null,
  );
  const [bookmarked, setBookmarked] = React.useState(false);
  const [tab, setTab] = React.useState<DetailTab>("explanation");
  const questionOpacity = React.useRef(new Animated.Value(1)).current;
  const questionTranslation = React.useRef(new Animated.Value(0)).current;
  const navigationDirection = React.useRef<NavigationDirection>("next");
  const renderedQuestionId = React.useRef<number | null>(null);
  const routeFilters = React.useMemo(
    () => ({
      keyword: paramValue(palavraChave),
      bancas: paramList(bancas),
      anos: paramList(anos),
      materias: paramList(materias),
      assuntos: paramList(assuntos),
      orgaos: paramList(orgaos),
      cargos: paramList(cargos),
      focos: paramList(focos),
      niveis: paramList(niveis),
      modalidades: paramList(modalidades),
      dificuldades: paramList(dificuldades),
      apenasSalvas: paramValue(apenasSalvas) === "1",
      comentarioProfessor: paramValue(comentarioProfessor) === "1",
      analiseDetalhada: paramValue(analiseDetalhada) === "1",
      excluirAnuladas: paramValue(excluirAnuladas) === "1",
      excluirDesatualizadas: paramValue(excluirDesatualizadas) === "1",
      naoRespondidas: paramValue(naoRespondidas) === "1",
    }),
    [analiseDetalhada, anos, bancas, assuntos, apenasSalvas, comentarioProfessor, cargos, excluirAnuladas, excluirDesatualizadas, dificuldades, focos, materias, modalidades, niveis, naoRespondidas, orgaos, palavraChave],
  );
  const questionFlowFilters = React.useMemo<QuestionListFilters>(
    () => ({
      keyword: routeFilters.keyword || undefined,
      agency: routeFilters.bancas.length > 0 ? routeFilters.bancas : undefined,
      year: routeFilters.anos.length > 0 ? routeFilters.anos : undefined,
      subject:
        routeFilters.materias.length > 0 ? routeFilters.materias : undefined,
      topic:
        routeFilters.assuntos.length > 0 ? routeFilters.assuntos : undefined,
      organization: routeFilters.orgaos.length > 0 ? routeFilters.orgaos : undefined,
      role: routeFilters.cargos.length > 0 ? routeFilters.cargos : undefined,
      career: routeFilters.focos.length > 0 ? routeFilters.focos : undefined,
      level: routeFilters.niveis.length > 0 ? routeFilters.niveis : undefined,
      modality: routeFilters.modalidades.length > 0 ? routeFilters.modalidades : undefined,
      difficulty:
        routeFilters.dificuldades.length > 0
          ? routeFilters.dificuldades.map((value) =>
              value === "easy"
                ? "Facil"
                : value === "medium"
                  ? "Medio"
                  : "Dificil",
            )
          : undefined,
      onlySaved: routeFilters.apenasSalvas || undefined,
      hasTeacherComment: routeFilters.comentarioProfessor || undefined,
      hasDetailedComment: routeFilters.analiseDetalhada || undefined,
      excludeCanceled: routeFilters.excluirAnuladas || undefined,
      excludeOutdated: routeFilters.excluirDesatualizadas || undefined,
      excludeAnswered: routeFilters.naoRespondidas || undefined,
    }),
    [routeFilters],
  );
  const hasQuestionFilters = Boolean(
    routeFilters.bancas.length ||
    routeFilters.keyword ||
    routeFilters.anos.length ||
    routeFilters.materias.length ||
    routeFilters.assuntos.length ||
    routeFilters.orgaos.length ||
    routeFilters.cargos.length ||
    routeFilters.focos.length ||
    routeFilters.niveis.length ||
    routeFilters.modalidades.length ||
    routeFilters.dificuldades.length ||
    routeFilters.apenasSalvas ||
    routeFilters.comentarioProfessor ||
    routeFilters.analiseDetalhada ||
    routeFilters.excluirAnuladas ||
    routeFilters.excluirDesatualizadas ||
    routeFilters.naoRespondidas,
  );
  const hasQuestionFlow = flowParam === "1" || hasQuestionFilters;
  const flowPageSize = 100;
  const questionQuery = useQuery({
    queryKey: [
      "questions",
      "detail",
      hasQuestionFlow ? questionFlowFilters : { questionIds: [questionId] },
      hasQuestionFlow ? currentPage : 1,
    ],
    queryFn: async () => {
      const result = await questionService.getQuestionPage({
        ...(hasQuestionFlow
          ? questionFlowFilters
          : { questionIds: [activeQuestionId] }),
        limit: hasQuestionFlow ? flowPageSize : 1,
        page: hasQuestionFlow ? currentPage : 1,
      });
      return {
        rows: result.rows,
        total: hasQuestionFlow ? result.total : 1,
        pages: hasQuestionFlow ? result.pages : 1,
      };
    },
    enabled: Number.isFinite(activeQuestionId) && activeQuestionId > 0,
  });
  const answerMutation = useAnswerQuestionMutation(user?.id);
  const activeQuestion = React.useMemo(
    () =>
      questionQuery.data?.rows.find(
        (item) => String(item.id) === String(activeQuestionId),
      ) || questionQuery.data?.rows[0],
    [activeQuestionId, questionQuery.data?.rows],
  );
  const question = answeredQuestion || activeQuestion;
  const answered = answeredQuestion !== null;
  const [commentDraft, setCommentDraft] = React.useState("");
  const commentsQuery = useQuestionCommentsQuery(
    activeQuestion?.id,
    user?.id,
    tab === "comments",
  );
  const addCommentMutation = useAddQuestionCommentMutation(
    activeQuestion?.id,
    user?.id,
    user?.name,
    user?.photoUrl,
    user?.plan,
  );
  const likeCommentMutation = useLikeQuestionCommentMutation(
    activeQuestion?.id,
    user?.id,
  );
  const correctOption = question ? resolveCorrect(question) : undefined;
  const currentQuestionIndex = React.useMemo(() => {
    const index = (questionQuery.data?.rows || []).findIndex(
      (item) => String(item.id) === String(activeQuestionId),
    );
    return index >= 0 ? index : 0;
  }, [activeQuestionId, questionQuery.data?.rows]);
  const questionPosition = hasQuestionFlow
    ? (currentPage - 1) * flowPageSize + currentQuestionIndex + 1
    : 1;
  const questionTotal = Math.max(
    1,
    questionQuery.data?.total || questionQuery.data?.rows.length || 1,
  );
  const progressPercent = Math.min(
    100,
    Math.max(0, (questionPosition / questionTotal) * 100),
  );
  const nextQuestionId = React.useMemo(() => {
    const rows = questionQuery.data?.rows || [];
    if (hasQuestionFlow) {
      return rows[currentQuestionIndex + 1]?.id;
    }
    return undefined;
  }, [
    currentQuestionIndex,
    hasQuestionFlow,
    questionQuery.data?.rows,
  ]);
  const previousQuestionId = React.useMemo(() => {
    const rows = questionQuery.data?.rows || [];
    if (hasQuestionFlow) {
      return rows[currentQuestionIndex - 1]?.id;
    }
    return undefined;
  }, [currentQuestionIndex, hasQuestionFlow, questionQuery.data?.rows]);
  const hasNextPage = Boolean(
    hasQuestionFlow &&
      currentPage < (questionQuery.data?.pages || 0),
  );
  const hasPreviousPage = Boolean(hasQuestionFlow && currentPage > 1);
  const canGoToNextQuestion = Boolean(nextQuestionId || hasNextPage);
  const canGoToPreviousQuestion = Boolean(
    previousQuestionId || hasPreviousPage,
  );

  React.useEffect(() => {
    const pageRows = questionQuery.data?.rows || [];
    const activeQuestionIsLoaded = pageRows.some(
      (item) => String(item.id) === String(activeQuestionId),
    );
    if (pageRows.length && !activeQuestionIsLoaded) {
      const target = pageTarget === "last" ? pageRows[pageRows.length - 1] : pageRows[0];
      setActiveQuestionId(Number(target.id));
      setPageTarget(null);
    }
  }, [activeQuestionId, pageTarget, questionQuery.data?.rows]);

  React.useEffect(() => {
    setSelected(null);
    setAnsweredQuestion(null);
    setTab("explanation");
  }, [activeQuestion?.id]);

  React.useEffect(() => {
    if (!activeQuestion?.id) {
      setBookmarked(false);
      return;
    }

    setBookmarked(
      Boolean(
        user?.savedQuestionIds
          ?.map(String)
          .includes(String(activeQuestion.id)),
      ),
    );
  }, [activeQuestion?.id, user?.savedQuestionIds]);

  React.useEffect(() => {
    if (!activeQuestion?.id) return;
    if (renderedQuestionId.current === null) {
      renderedQuestionId.current = Number(activeQuestion.id);
      return;
    }
    if (renderedQuestionId.current === Number(activeQuestion.id)) return;

    renderedQuestionId.current = Number(activeQuestion.id);
    const fromValue = navigationDirection.current === "next" ? 24 : -24;
    questionOpacity.stopAnimation();
    questionTranslation.stopAnimation();
    questionOpacity.setValue(0);
    questionTranslation.setValue(fromValue);
    Animated.parallel([
      Animated.timing(questionOpacity, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(questionTranslation, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeQuestion?.id, questionOpacity, questionTranslation]);

  const handleTopBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/questoes");
  };

  const goToNextQuestion = () => {
    if (nextQuestionId) {
      navigationDirection.current = "next";
      setActiveQuestionId(Number(nextQuestionId));
      router.setParams({ id: String(nextQuestionId) });
      return;
    }
    if (hasNextPage) {
      navigationDirection.current = "next";
      setPageTarget("first");
      setCurrentPage((page) => page + 1);
      return;
    }
  };

  const goToPreviousQuestion = () => {
    if (previousQuestionId) {
      navigationDirection.current = "previous";
      setActiveQuestionId(Number(previousQuestionId));
      router.setParams({ id: String(previousQuestionId) });
      return;
    }
    if (hasPreviousPage) {
      navigationDirection.current = "previous";
      setPageTarget("last");
      setCurrentPage((page) => page - 1);
    }
  };

  const submitAnswer = async () => {
    if (!question?.id || selected === null || answered) return;
    try {
      const { result } = await answerMutation.mutateAsync({
        questionId: question.id,
        selectedOptionIndex: selected,
      });
      setAnsweredQuestion({
        ...question,
        correctOptionIndex:
          result.correctOptionIndex ?? question.correctOptionIndex,
        userAnswer: {
          questionId: question.id,
          selectedOptionIndex: selected,
          isCorrect: result.isCorrect ?? result.correctOptionIndex === selected,
          timestamp: Date.now(),
        },
      });
      if (result.newXp !== undefined || result.newLevel !== undefined)
        await refreshProfile();
    } catch (error: any) {
      Alert.alert(
        "Erro ao responder",
        error?.message || "Não foi possível registrar a resposta.",
      );
    }
  };

  const toggleBookmark = async () => {
    if (!question?.id) return;
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await toggleSavedQuestion(question.id);
      await queryClient.invalidateQueries({
        queryKey: questionQueryKeys.lists(),
      });
    } catch (error: any) {
      setBookmarked(!next);
      Alert.alert(
        "Salvar questão",
        error?.message || "Não foi possível atualizar esta questão.",
      );
    }
  };

  if (questionQuery.isPending)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.muted}>Carregando questão...</Text>
      </View>
    );
  if (questionQuery.isError || !question)
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
        <Text style={styles.errorTitle}>Questão indisponível</Text>
        <Text style={styles.muted}>
          Não foi possível carregar esta questão do banco oficial.
        </Text>
        <Pressable
          onPress={() => void questionQuery.refetch()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );

  const metadata = [
    ["Banca", label(question.bancas?.[0])],
    ["Ano", question.anos?.[0] ? String(question.anos[0]) : ""],
    ["Órgão", label(question.orgaos?.[0])],
    ["Cargo", label(question.cargos?.[0])],
    ["Matéria", label(question.assuntos?.find((item) => item.materia))],
    ["Assunto", label(question.assuntos?.find((item) => !item.materia))],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { paddingTop: spacing[2] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para os filtros"
          onPress={handleTopBack}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={theme.text} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.topEyebrow}>
            Questão {questionPosition} de {questionTotal}
          </Text>
          <Text style={styles.topMeta}>
            {label(question.bancas?.[0])} · {question.anos?.[0] || "--"}
          </Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              bookmarked ? "Remover dos salvos" : "Salvar questão"
            }
            onPress={() => void toggleBookmark()}
            style={styles.iconButton}
          >
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color={bookmarked ? theme.warning : theme.textMuted}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reportar questão"
            onPress={() =>
              Alert.alert(
                "Reportar questão",
                "A denúncia será enviada para análise.",
              )
            }
            style={styles.iconButton}
          >
            <Ionicons name="flag-outline" size={19} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${progressPercent}%` },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.questionBody,
          {
            opacity: questionOpacity,
            transform: [{ translateX: questionTranslation }],
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 104 },
          ]}
        >
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoEyebrow}>INFORMAÇÕES DA QUESTÃO</Text>
            <Text style={styles.infoId}>#{question.id}</Text>
          </View>
          <View style={styles.chips}>
            {metadata.map(([name, value]) => (
              <View
                key={`${name}-${value}`}
                style={[
                  styles.chip,
                  (name === "Matéria" || name === "Assunto") &&
                    styles.primaryChip,
                ]}
              >
                <Text style={styles.chipLabel}>{name}: </Text>
                <Text style={styles.chipValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.statement}>
          {clean(question.enunciado_clean || question.enunciado) ||
            "Questão sem enunciado."}
        </Text>
        <View style={styles.options}>
          {(question.itens || []).map((item, index) => {
            const selectedOption = selected === index;
            const isCorrect = answered && correctOption === index;
            const isWrong = answered && selected === index && !isCorrect;
            return (
              <Pressable
                key={`${question.id}-${item.id || index}`}
                accessibilityRole="button"
                disabled={answered || answerMutation.isPending}
                onPress={() => setSelected(index)}
                style={[
                  styles.option,
                  selectedOption && !answered && styles.optionSelected,
                  isCorrect && styles.optionCorrect,
                  isWrong && styles.optionWrong,
                  answered && !isCorrect && !isWrong && styles.optionFaded,
                ]}
              >
                <View
                  style={[
                    styles.letter,
                    selectedOption && !answered && styles.letterSelected,
                    isCorrect && styles.letterCorrect,
                    isWrong && styles.letterWrong,
                  ]}
                >
                  {isCorrect ? (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={theme.onPrimary}
                    />
                  ) : isWrong ? (
                    <Ionicons name="close" size={15} color={theme.onPrimary} />
                  ) : (
                    <Text
                      style={[
                        styles.letterText,
                        selectedOption &&
                          !answered &&
                          styles.letterTextSelected,
                      ]}
                    >
                      {String.fromCharCode(65 + index)}
                    </Text>
                  )}
                </View>
                <Text style={styles.optionText}>
                  {clean(item.corpo_clean || item.corpo)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {answered ? (
          <View
            style={[
              styles.resultBanner,
              {
                backgroundColor: question.userAnswer?.isCorrect
                  ? theme.successSubtle
                  : theme.dangerSubtle,
                borderColor: question.userAnswer?.isCorrect
                  ? theme.successBorder
                  : theme.dangerBorder,
              },
            ]}
          >
            <Ionicons
              name={
                question.userAnswer?.isCorrect
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={20}
              color={
                question.userAnswer?.isCorrect ? theme.success : theme.danger
              }
            />
            <Text
              style={[
                styles.resultText,
                {
                  color: question.userAnswer?.isCorrect
                    ? theme.success
                    : theme.danger,
                },
              ]}
            >
              {question.userAnswer?.isCorrect
                ? "Resposta correta!"
                : "Resposta incorreta"}
            </Text>
          </View>
        ) : null}
        <View style={styles.tabs}>
          {(
            [
              ["explanation", "book-outline", "Gabarito"],
              ["teacher", "school-outline", "Professor"],
              ["stats", "bar-chart-outline", "Stats"],
              ["comments", "chatbubble-outline", "Discussão"],
            ] as const
          ).map(([value, icon, title]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              disabled={
                !answered && (value === "explanation" || value === "teacher")
              }
              onPress={() => setTab(value)}
              style={[
                styles.tab,
                tab === value && styles.tabActive,
                !answered &&
                  (value === "explanation" || value === "teacher") &&
                  styles.tabDisabled,
              ]}
            >
              <Ionicons
                name={icon}
                size={16}
                color={tab === value ? theme.primary : theme.textMuted}
              />
              <Text
                style={[styles.tabText, tab === value && styles.tabTextActive]}
              >
                {title}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.detailPanel}>
          {!answered && (tab === "explanation" || tab === "teacher") ? (
            <LockedTeaser styles={styles} />
          ) : tab === "explanation" ? (
            <>
              <Text style={styles.panelTitle}>Resumo do gabarito</Text>
              <Text style={styles.panelBody}>
                {clean(question.detailedComment) ||
                  "O gabarito comentado será exibido aqui após a resposta."}
              </Text>
              <View style={styles.correctHint}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={theme.success}
                />
                <Text style={styles.correctHintText}>
                  Alternativa correta:{" "}
                  {correctOption === undefined
                    ? "--"
                    : String.fromCharCode(65 + correctOption)}
                </Text>
              </View>
            </>
          ) : tab === "teacher" ? (
            <>
              <Text style={styles.panelTitle}>Comentário do professor</Text>
              <Text style={styles.panelBody}>
                {clean(question.teacherComment) ||
                  "Comentário do professor ainda não disponível."}
              </Text>
              <View style={styles.videoPlaceholder}>
                <Ionicons
                  name="play-circle-outline"
                  size={36}
                  color={theme.onPrimary}
                />
                <Text style={styles.videoText}>Vídeo-explicação · Premium</Text>
              </View>
            </>
          ) : tab === "stats" ? (
            <>
              <Text style={styles.panelTitle}>Estatísticas</Text>
              <View style={styles.statsRow}>
                <Metric
                  label="Respostas"
                  value={String(question.stats?.totalAttempts || 0)}
                  styles={styles}
                />
                <Metric
                  label="Acertos"
                  value={String(question.stats?.correctCount || 0)}
                  styles={styles}
                />
                <Metric
                  label="Erros"
                  value={String(question.stats?.wrongCount || 0)}
                  styles={styles}
                />
              </View>
            </>
          ) : (
            <QuestionCommentsPanel
              comments={commentsQuery.data ?? []}
              loading={commentsQuery.isLoading}
              draft={commentDraft}
              canComment={Boolean(user?.id)}
              submitting={
                addCommentMutation.isPending || likeCommentMutation.isPending
              }
              onChangeDraft={setCommentDraft}
              onSubmitComment={async (content, parentId) => {
                try {
                  await addCommentMutation.mutateAsync({ content, parentId });
                  if (!parentId) setCommentDraft("");
                } catch (error: any) {
                  Alert.alert(
                    "Comentários",
                    error?.message ||
                      "Não foi possível publicar o comentário.",
                  );
                }
              }}
              onLikeComment={async (commentId) => {
                try {
                  await likeCommentMutation.mutateAsync(commentId);
                } catch (error: any) {
                  Alert.alert(
                    "Comentários",
                    error?.message || "Não foi possível curtir o comentário.",
                  );
                }
              }}
            />
          )}
        </View>
        </ScrollView>
      </Animated.View>
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + spacing[3] },
        ]}
      >
        {answered ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar para a questão anterior"
              disabled={!canGoToPreviousQuestion || questionQuery.isFetching}
              onPress={goToPreviousQuestion}
              style={[
                styles.secondaryButton,
                (!canGoToPreviousQuestion || questionQuery.isFetching) &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons name="arrow-back" size={17} color={theme.text} />
              <Text style={styles.secondaryButtonText}>Voltar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Próxima questão"
              disabled={!canGoToNextQuestion || questionQuery.isFetching}
              onPress={goToNextQuestion}
              style={[
                styles.primaryButton,
                (!canGoToNextQuestion || questionQuery.isFetching) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {questionQuery.isFetching
                  ? "Carregando questões..."
                  : "Próxima questão"}
              </Text>
              {!questionQuery.isFetching ? (
                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color={theme.onPrimary}
                />
              ) : null}
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Questão anterior"
              disabled={!canGoToPreviousQuestion || questionQuery.isFetching}
              hitSlop={8}
              onPress={goToPreviousQuestion}
              style={[
                styles.arrowButton,
                (!canGoToPreviousQuestion || questionQuery.isFetching) &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons name="arrow-back" size={21} color={theme.text} />
            </Pressable>
            <Pressable
              disabled={selected === null || answerMutation.isPending}
              onPress={() => void submitAnswer()}
              style={[
                styles.primaryButton,
                (selected === null || answerMutation.isPending) &&
                  styles.disabledButton,
              ]}
            >
              {answerMutation.isPending ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Confirmar resposta
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Próxima questão"
              disabled={!canGoToNextQuestion || questionQuery.isFetching}
              hitSlop={8}
              onPress={goToNextQuestion}
              style={[
                styles.arrowButton,
                (!canGoToNextQuestion || questionQuery.isFetching) &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons name="arrow-forward" size={21} color={theme.text} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const LockedTeaser = ({
  styles,
}: {
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.locked}>
    <Ionicons name="lock-closed-outline" size={22} color="#64748B" />
    <Text style={styles.lockedTitle}>
      Responda a questão para liberar este conteúdo
    </Text>
    <Text style={styles.lockedBody}>
      O gabarito e a explicação aparecem depois da confirmação.
    </Text>
  </View>
);
const Metric = ({
  label: title,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{title}</Text>
  </View>
);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    topBar: {
      alignItems: "center",
      backgroundColor: theme.surface,
      flexDirection: "row",
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
    },
    topCopy: { alignItems: "center", flex: 1 },
    topEyebrow: { color: theme.textMuted, fontSize: 10 },
    topMeta: {
      color: theme.text,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      marginTop: 2,
    },
    topActions: { flexDirection: "row", gap: spacing[1] },
    iconButton: {
      alignItems: "center",
      borderRadius: radius.pill,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    progressTrack: { backgroundColor: theme.surfaceSubtle, height: 4 },
    progressFill: { height: "100%" },
    questionBody: { flex: 1 },
    content: { gap: spacing[5], padding: spacing[5] },
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
      borderColor: theme.primary,
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
    resultBanner: {
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      padding: spacing[4],
    },
    resultText: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    tabs: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.md,
      flexDirection: "row",
      padding: 3,
    },
    tab: {
      alignItems: "center",
      borderRadius: radius.sm,
      flex: 1,
      gap: 3,
      paddingVertical: spacing[2],
    },
    tabActive: { backgroundColor: theme.surface },
    tabDisabled: { opacity: 0.45 },
    tabText: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: typography.weight.semibold,
    },
    tabTextActive: { color: theme.primary },
    detailPanel: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[5],
    },
    panelTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    panelBody: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      lineHeight: 21,
    },
    correctHint: {
      alignItems: "center",
      backgroundColor: theme.successSubtle,
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: spacing[2],
      padding: spacing[3],
    },
    correctHintText: {
      color: theme.success,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    videoPlaceholder: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      gap: spacing[2],
      justifyContent: "center",
      minHeight: 140,
    },
    videoText: {
      color: theme.onPrimary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    statsRow: { flexDirection: "row", gap: spacing[2] },
    metric: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.md,
      flex: 1,
      padding: spacing[3],
    },
    metricValue: {
      color: theme.primary,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    metricLabel: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
    locked: {
      alignItems: "center",
      gap: spacing[2],
      paddingVertical: spacing[5],
    },
    lockedTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      textAlign: "center",
    },
    lockedBody: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      textAlign: "center",
    },
    bottomBar: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
    },
    arrowButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 52,
    },
    secondaryButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flex: 1,
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    primaryButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    disabledButton: { opacity: 0.45 },
    center: {
      alignItems: "center",
      backgroundColor: theme.background,
      flex: 1,
      gap: spacing[3],
      justifyContent: "center",
      padding: spacing[6],
    },
    muted: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      textAlign: "center",
    },
    errorTitle: {
      color: theme.danger,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    retryButton: {
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    retryText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
  });
