import React from "react";
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { questionQueryKeys } from "@/features/questions/api/queryKeys";
import { useAnswerQuestionMutation } from "@/features/questions/api/useAnswerQuestionMutation";
import { QuestionBottomActions, QuestionHeader, QuestionMetadata, QuestionOption, type QuestionMetadataItem } from "@/components/questions/QuestionScreenPrimitives";
import { QuestionRichContent } from "@/components/questions/QuestionRichContent";
import { GuestAccessSheet } from "@/components/GuestAccessSheet";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { questionService } from "@/services/questions/questionService";
import { reportsService } from "@/services/reports/reportsService";
import { useAuth } from "@/providers/AuthProvider";
import { useAdExperience } from "@/providers/AdExperienceProvider";
import { darkTheme, palette, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { Question, QuestionAsset, QuestionListFilters } from "@/types/questions";

type NavigationDirection = "next" | "previous";

const QUESTION_REPORT_REASONS = [
  "Gabarito incorreto",
  "Enunciado incorreto",
  "Erro de formatação",
  "Classificação incorreta",
  "Questão desatualizada",
  "Imagem ou mídia com problema",
  "Outro",
] as const;

const label = (value?: { nome?: string; sigla?: string; descricao?: string; ["descrição"]?: string }): string => String(value?.sigla || value?.nome || value?.descricao || value?.["descrição"] || "").trim();
const paramValue = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0] || "" : value || "";
const paramList = (value: string | string[] | undefined): string[] => paramValue(value).split(",").map((item) => item.trim()).filter(Boolean);

const resolveCorrect = (question: Question): number | undefined => {
  if (Number.isInteger(question.correctOptionIndex)) return question.correctOptionIndex;
  if (Number.isInteger(question.resposta)) return Number(question.resposta) > 0 ? Number(question.resposta) - 1 : Number(question.resposta);
  return undefined;
};

const countComments = (comments: Question["comments"]): number =>
  comments?.reduce((total, comment) => total + 1 + countComments(comment.replies), 0) || 0;

const alternativeText = (item: any): string => String(item?.text || item?.corpo || item?.textClean || item?.corpo_clean || item?.descricao || item?.description || "");
const alternativeLabel = (item: any, index: number): string => String(item?.label || item?.rotulo || String.fromCharCode(65 + index)).trim();

const buildMetadata = (question: Question): QuestionMetadataItem[] => {
  const subject = question.assuntos?.find((item) => item.materia);
  const topic = question.assuntos?.find((item) => !item.materia);
  return [
    { label: "Matéria", value: label(subject) },
    { label: "Assunto", value: label(topic) },
    { label: "Banca", value: label(question.bancas?.[0]) },
    { label: "Ano", value: question.anos?.[0] ? String(question.anos[0]) : "" },
    { label: "Órgão", value: label(question.orgaos?.[0]) },
    { label: "Cargo", value: label(question.cargos?.[0]) },
  ].filter((item) => Boolean(item.value));
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  iconButton: { alignItems: "center", height: 42, justifyContent: "center", width: 38 },
  questionBody: { flex: 1 },
  content: { gap: spacing[5], paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  supportContent: { marginBottom: -spacing[2] },
  associatedTextToggle: { alignItems: "center", backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3] },
  associatedTextIcon: { alignItems: "center", backgroundColor: theme.surface, borderRadius: radius.sm, height: 28, justifyContent: "center", width: 28 },
  associatedTextToggleLabel: { color: theme.primary, flex: 1, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  associatedTextPanel: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, gap: spacing[3], padding: spacing[3] },
  statementBlock: { gap: spacing[2] },
  questionLabel: { color: theme.textMuted, fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 0.7, textTransform: "uppercase" },
  statement: { color: theme.text, fontSize: typography.size.md, lineHeight: 24 },
  options: { gap: spacing[2] },
  resultBanner: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[3] },
  resultCorrect: { backgroundColor: theme.successSubtle, borderColor: theme.successBorder },
  resultWrong: { backgroundColor: theme.dangerSubtle, borderColor: theme.dangerBorder },
  resultTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  resultCopy: { flex: 1, gap: 2 },
  detailPanel: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, gap: spacing[3], padding: spacing[4] },
  panelTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  panelBody: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 22 },
  correctHint: { alignItems: "center", backgroundColor: theme.successSubtle, borderRadius: radius.sm, flexDirection: "row", gap: spacing[2], padding: spacing[3] },
  correctHintText: { color: theme.success, flex: 1, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  teacherHeader: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  teacherAvatar: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.pill, height: 42, justifyContent: "center", width: 42 },
  teacherCopy: { flex: 1, gap: 2 },
  teacherBadge: { color: theme.primary, fontSize: 10, fontWeight: typography.weight.bold, textTransform: "uppercase" },
  teacherMore: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  teacherMoreText: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  metric: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.sm, flexBasis: "48%", flexGrow: 1, gap: 2, padding: spacing[3] },
  metricValue: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  metricLabel: { color: theme.textMuted, fontSize: 10 },
  comparison: { gap: spacing[2] },
  comparisonTitle: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  statRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  statLabel: { color: theme.textMuted, fontSize: 10, width: 74 },
  statTrack: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, flex: 1, height: 8, overflow: "hidden" },
  statFill: { backgroundColor: theme.primary, borderRadius: radius.pill, height: "100%" },
  statValue: { color: theme.text, fontSize: 10, fontWeight: typography.weight.bold, width: 32 },
  errorScreen: { alignItems: "center", backgroundColor: theme.background, flex: 1, justifyContent: "center", padding: spacing[6] },
  errorHeader: { alignItems: "center", alignSelf: "stretch", flexDirection: "row", marginBottom: spacing[8] },
  errorHeaderTitle: { color: theme.text, flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.bold, textAlign: "center" },
  errorTitle: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold, marginTop: spacing[3], textAlign: "center" },
  errorBody: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20, marginTop: spacing[2], textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: theme.primary, borderRadius: radius.button, marginTop: spacing[5], minHeight: 48, justifyContent: "center", paddingHorizontal: spacing[6] },
  retryText: { color: theme.onPrimary, fontSize: typography.role.button.fontSize, lineHeight: typography.role.button.lineHeight, fontWeight: typography.role.button.fontWeight },
  reportBackdrop: { backgroundColor: "rgba(10,10,35,0.56)", flex: 1, justifyContent: "flex-end" },
  reportBackdropDismiss: { ...StyleSheet.absoluteFill },
  reportSheet: { ...(theme === darkTheme ? shadows.modalDark : shadows.modal), backgroundColor: theme.surface, borderTopLeftRadius: radius.dialog, borderTopRightRadius: radius.dialog, gap: spacing[3], height: "90%", paddingHorizontal: spacing[5], paddingTop: spacing[3], width: "100%" },
  reportHandle: { alignSelf: "center", backgroundColor: theme.borderStrong, borderRadius: radius.pill, height: 4, marginBottom: spacing[2], width: 40 },
  reportTitle: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  reportDescription: { color: theme.textMuted, fontSize: typography.size.xs, lineHeight: 19, marginBottom: spacing[1] },
  reportFieldLabel: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold, marginTop: spacing[2] },
  reportRequired: { color: theme.danger, fontWeight: typography.weight.medium },
  reportReasonList: { gap: spacing[2] },
  reportReason: { alignItems: "center", borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 46, paddingHorizontal: spacing[3] },
  reportReasonSelected: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  reportRadio: { alignItems: "center", borderColor: theme.borderStrong, borderRadius: radius.pill, borderWidth: 1.5, height: 18, justifyContent: "center", width: 18 },
  reportRadioSelected: { borderColor: theme.primary },
  reportRadioDot: { backgroundColor: theme.primary, borderRadius: radius.pill, height: 9, width: 9 },
  reportReasonText: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  reportReasonTextSelected: { color: theme.primary, fontWeight: typography.weight.bold },
  reportDetailsInput: { backgroundColor: theme.background, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, fontSize: typography.size.sm, lineHeight: 20, minHeight: 108, padding: spacing[3], textAlignVertical: "top" },
  reportFooter: { borderTopColor: theme.border, borderTopWidth: 1, flexDirection: "row", gap: spacing[3], paddingTop: spacing[3] },
  reportCancel: { alignItems: "center", borderColor: theme.border, borderRadius: radius.button, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[4] },
  reportCancelText: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  reportSubmit: { alignItems: "center", backgroundColor: theme.danger, borderRadius: radius.button, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[4] },
  reportSubmitText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  detailActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[1] },
  detailAction: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexBasis: "47%", flexDirection: "row", flexGrow: 1, gap: spacing[1], minHeight: 54, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  detailActionDisabled: { backgroundColor: theme.surfaceSubtle },
  detailActionIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.sm, height: 24, justifyContent: "center", width: 24 },
  detailActionIconDisabled: { backgroundColor: theme.background },
  detailActionCopy: { alignItems: "center", flex: 1, flexDirection: "row", justifyContent: "space-between", minWidth: 0 },
  detailActionTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  detailActionTitleDisabled: { color: theme.textSubtle },
  discussionCount: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.pill, minWidth: 22, paddingHorizontal: spacing[1], paddingVertical: 2 },
  discussionCountText: { color: theme.primary, fontSize: 10, fontWeight: typography.weight.bold },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.5 },
  skeletonLine: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.sm, height: 16 },
  skeletonOption: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, height: 76 },
  skeleton: { gap: spacing[5], padding: spacing[5] },
});

export default function QuestionViewScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, isGuest, refreshProfile, toggleSavedQuestion } = useAuth();
  const { registerPageTransition } = useAdExperience();
  const isVisitor = isGuest || !user?.id;
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string | string[]; flow?: string | string[]; palavraChave?: string | string[]; bancas?: string | string[]; anos?: string | string[]; materias?: string | string[]; assuntos?: string | string[]; orgaos?: string | string[]; cargos?: string | string[]; focos?: string | string[]; niveis?: string | string[]; modalidades?: string | string[]; dificuldades?: string | string[]; apenasSalvas?: string | string[]; comentarioProfessor?: string | string[]; analiseDetalhada?: string | string[]; excluirAnuladas?: string | string[]; excluirDesatualizadas?: string | string[]; naoRespondidas?: string | string[] }>();
  const questionId = Number(paramValue(params.id));
  const hasFlowParam = paramValue(params.flow) === "1";
  const [activeQuestionId, setActiveQuestionId] = React.useState(questionId);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageTarget, setPageTarget] = React.useState<"first" | "last" | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [answeredQuestion, setAnsweredQuestion] = React.useState<Question | null>(null);
  const [bookmarked, setBookmarked] = React.useState(false);
  const [reportModalVisible, setReportModalVisible] = React.useState(false);
  const [reportReason, setReportReason] = React.useState<string>("");
  const [reportDetails, setReportDetails] = React.useState("");
  const [reportSubmitting, setReportSubmitting] = React.useState(false);
  const [guestAccessVisible, setGuestAccessVisible] = React.useState(false);
  const [guestAccessDescription, setGuestAccessDescription] = React.useState("");
  const [pendingReportIds, setPendingReportIds] = React.useState<Record<string, true>>({});
  const [metadataExpanded, setMetadataExpanded] = React.useState(false);
  const [associatedTextExpanded, setAssociatedTextExpanded] = React.useState(false);
  const direction = React.useRef<NavigationDirection>("next");
  const renderedId = React.useRef<number | null>(null);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const translation = React.useRef(new Animated.Value(0)).current;

  const routeFilters = React.useMemo(() => ({
    keyword: paramValue(params.palavraChave), bancas: paramList(params.bancas), anos: paramList(params.anos), materias: paramList(params.materias), assuntos: paramList(params.assuntos), orgaos: paramList(params.orgaos), cargos: paramList(params.cargos), focos: paramList(params.focos), niveis: paramList(params.niveis), modalidades: paramList(params.modalidades), dificuldades: paramList(params.dificuldades), apenasSalvas: paramValue(params.apenasSalvas) === "1", comentarioProfessor: paramValue(params.comentarioProfessor) === "1", analiseDetalhada: paramValue(params.analiseDetalhada) === "1", excluirAnuladas: paramValue(params.excluirAnuladas) === "1", excluirDesatualizadas: paramValue(params.excluirDesatualizadas) === "1", naoRespondidas: paramValue(params.naoRespondidas) === "1",
  }), [params]);

  const questionFilters = React.useMemo<QuestionListFilters>(() => ({
    keyword: routeFilters.keyword || undefined,
    agency: routeFilters.bancas.length ? routeFilters.bancas : undefined,
    year: routeFilters.anos.length ? routeFilters.anos : undefined,
    subject: routeFilters.materias.length ? routeFilters.materias : undefined,
    topic: routeFilters.assuntos.length ? routeFilters.assuntos : undefined,
    organization: routeFilters.orgaos.length ? routeFilters.orgaos : undefined,
    role: routeFilters.cargos.length ? routeFilters.cargos : undefined,
    career: routeFilters.focos.length ? routeFilters.focos : undefined,
    level: routeFilters.niveis.length ? routeFilters.niveis : undefined,
    modality: routeFilters.modalidades.length ? routeFilters.modalidades : undefined,
    difficulty: routeFilters.dificuldades.length ? routeFilters.dificuldades.map((value) => value === "easy" ? "Facil" : value === "medium" ? "Medio" : "Dificil") : undefined,
    onlySaved: routeFilters.apenasSalvas || undefined,
    hasTeacherComment: routeFilters.comentarioProfessor || undefined,
    hasDetailedComment: routeFilters.analiseDetalhada || undefined,
    excludeCanceled: routeFilters.excluirAnuladas || undefined,
    excludeOutdated: routeFilters.excluirDesatualizadas || undefined,
    excludeAnswered: routeFilters.naoRespondidas || undefined,
  }), [routeFilters]);
  const hasFilterValues = Object.values(routeFilters).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  const hasFlow = hasFlowParam || hasFilterValues;
  const pageSize = 100;
  const questionQuery = useQuery({
    queryKey: ["questions", "detail", hasFlow ? questionFilters : { questionIds: [activeQuestionId] }, hasFlow ? currentPage : 1],
    queryFn: async () => {
      const result = await questionService.getQuestionPage({ ...(hasFlow ? questionFilters : { questionIds: [activeQuestionId] }), page: hasFlow ? currentPage : 1, limit: hasFlow ? pageSize : 1 });
      return { rows: result.rows, total: hasFlow ? result.total : 1, pages: hasFlow ? result.pages : 1 };
    },
    enabled: Number.isFinite(activeQuestionId) && activeQuestionId > 0,
  });
  const rows = questionQuery.data?.rows || [];
  const activeQuestion = React.useMemo(() => rows.find((item) => String(item.id) === String(activeQuestionId)) || rows[0], [activeQuestionId, rows]);
  const question = answeredQuestion || activeQuestion;
  const answered = Boolean(answeredQuestion);
  const answerMutation = useAnswerQuestionMutation(user?.id);
  const hasPendingReport = Boolean(pendingReportIds[String(activeQuestionId)]);
  const currentIndex = Math.max(0, rows.findIndex((item) => String(item.id) === String(activeQuestionId)));
  const position = hasFlow ? (currentPage - 1) * pageSize + currentIndex + 1 : 1;
  const total = Math.max(1, questionQuery.data?.total || rows.length || 1);
  const progress = Math.min(100, Math.max(0, (position / total) * 100));
  const nextId = hasFlow ? rows[currentIndex + 1]?.id : undefined;
  const previousId = hasFlow ? rows[currentIndex - 1]?.id : undefined;
  const canNext = Boolean(nextId || (hasFlow && currentPage < (questionQuery.data?.pages || 0)));
  const canPrevious = Boolean(previousId || (hasFlow && currentPage > 1));

  React.useEffect(() => {
    if (!rows.length || rows.some((item) => String(item.id) === String(activeQuestionId))) return;
    const target = pageTarget === "last" ? rows[rows.length - 1] : rows[0];
    setActiveQuestionId(Number(target.id));
    setPageTarget(null);
  }, [activeQuestionId, pageTarget, rows]);

  React.useEffect(() => {
    setSelected(null);
    setAnsweredQuestion(null);
    setMetadataExpanded(false);
    setAssociatedTextExpanded(false);
  }, [activeQuestion?.id]);

  React.useEffect(() => {
    setBookmarked(Boolean(activeQuestion?.id && user?.savedQuestionIds?.map(String).includes(String(activeQuestion.id))));
  }, [activeQuestion?.id, user?.savedQuestionIds]);

  React.useEffect(() => {
    if (!activeQuestion?.id) return;
    if (renderedId.current === null) {
      renderedId.current = Number(activeQuestion.id);
      return;
    }
    if (renderedId.current === Number(activeQuestion.id)) return;
    renderedId.current = Number(activeQuestion.id);
    opacity.setValue(0);
    translation.setValue(direction.current === "next" ? 22 : -22);
    Animated.parallel([
      Animated.timing(opacity, { duration: 180, toValue: 1, useNativeDriver: true }),
      Animated.timing(translation, { duration: 220, toValue: 0, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) registerPageTransition();
    });
  }, [activeQuestion?.id, opacity, registerPageTransition, translation]);

  const advanceToNextQuestion = () => {
    if (nextId) {
      direction.current = "next";
      setActiveQuestionId(Number(nextId));
      router.setParams({ id: String(nextId) });
      return;
    }
    if (hasFlow && currentPage < (questionQuery.data?.pages || 0)) {
      direction.current = "next";
      setPageTarget("first");
      setCurrentPage((value) => value + 1);
    }
  };

  const goNext = () => {
    if (!canNext) return;
    advanceToNextQuestion();
  };

  const goPrevious = () => {
    if (previousId) {
      direction.current = "previous";
      setActiveQuestionId(Number(previousId));
      router.setParams({ id: String(previousId) });
      return;
    }
    if (hasFlow && currentPage > 1) {
      direction.current = "previous";
      setPageTarget("last");
      setCurrentPage((value) => value - 1);
    }
  };

  const handleBack = () => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/questoes");
  const requireAccount = (description: string) => {
    setGuestAccessDescription(description);
    setGuestAccessVisible(true);
  };

  const toggleBookmark = async () => {
    if (!question?.id) return;
    if (isVisitor) {
      requireAccount("Entre ou crie sua conta para salvar questões e acessá-las depois.");
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await toggleSavedQuestion(question.id);
      await queryClient.invalidateQueries({ queryKey: questionQueryKeys.lists() });
    } catch (error: any) {
      setBookmarked(!next);
      Alert.alert("Salvar questão", error?.message || "Não foi possível atualizar esta questão.");
    }
  };

  const reportQuestion = () => {
    if (!question?.id) return;
    if (isVisitor) {
      requireAccount("Entre ou crie sua conta para reportar uma questão.");
      return;
    }
    if (hasPendingReport) {
      Alert.alert("Denúncia em análise", "Você já reportou esta questão. Não é possível enviar outra denúncia enquanto a primeira estiver pendente.", undefined, { cancelable: true });
      return;
    }
    setReportReason("");
    setReportDetails("");
    setReportModalVisible(true);
  };

  const closeReportModal = () => {
    if (!reportSubmitting) setReportModalVisible(false);
  };

  const submitQuestionReport = async () => {
    if (!question?.id || !user?.id || !reportReason || !reportDetails.trim() || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const result = await reportsService.createReport({ reporterId: user.id, targetType: "question", targetId: question.id, reason: reportReason, details: reportDetails.trim() });
      setPendingReportIds((current) => ({ ...current, [String(question.id)]: true }));
      setReportModalVisible(false);
      Alert.alert(result.duplicate ? "Denúncia já registrada" : "Denúncia enviada", result.message || (result.duplicate ? "Sua denúncia anterior ainda está em análise." : "A equipe analisará esta questão."), undefined, { cancelable: true });
    } catch (error: any) {
      Alert.alert("Não foi possível denunciar", error?.message || "Tente novamente em alguns instantes.", undefined, { cancelable: true });
    } finally {
      setReportSubmitting(false);
    }
  };

  const openQuestionSection = (section: "answer" | "teacher" | "stats" | "discussion") => {
    if (!question?.id) return;
    if (isVisitor) {
      const sectionLabels = {
        answer: "ver o gabarito e a resolução da questão",
        teacher: "acessar o comentário do professor",
        stats: "consultar as estatísticas da questão",
        discussion: "acessar a discussão da questão",
      };
      requireAccount(`Entre ou crie sua conta para ${sectionLabels[section]}.`);
      return;
    }
    queryClient.setQueryData(["questions", "section", String(question.id)], question);
    router.push({ pathname: "/questao/detalhe/[id]", params: { id: String(question.id), section, selectedCorrect: String(Boolean(selectedCorrect)), selectedOption: String(selected ?? ""), answered: String(answered) } });
  };

  const submitAnswer = async () => {
    if (!question?.id || selected === null || answered) return;
    if (isVisitor) {
      requireAccount("Entre ou crie sua conta para responder questões e acompanhar seu progresso.");
      return;
    }
    try {
      const rawAlternative: any = question.alternatives?.[selected] || question.itens?.[selected];
      const selectedAlternativeId = rawAlternative?.tempId ?? rawAlternative?.id ?? rawAlternative?.canonicalId ?? rawAlternative?.rotulo ?? String.fromCharCode(65 + selected);
      const { result } = await answerMutation.mutateAsync({ questionId: question.id, selectedOptionIndex: selected, selectedAlternativeId });
      setAnsweredQuestion({ ...question, correctOptionIndex: result.correctOptionIndex ?? question.correctOptionIndex, userAnswer: { questionId: question.id, selectedOptionIndex: selected, isCorrect: result.isCorrect ?? result.correctOptionIndex === selected, timestamp: Date.now() } });
      if (result.newXp !== undefined || result.newLevel !== undefined) await refreshProfile();
    } catch (error: any) {
      Alert.alert("Erro ao responder", error?.message || "Não foi possível registrar a resposta.");
    }
  };

  if (questionQuery.isPending) return <QuestionSkeleton theme={theme} />;
  if (questionQuery.isError || !question) return <QuestionError theme={theme} onBack={handleBack} onRetry={() => void questionQuery.refetch()} />;

  const metadata = buildMetadata(question);
  const summary = ["Matéria", "Banca", "Ano"].map((key) => metadata.find((item) => item.label === key)?.value).filter(Boolean).join(" · ");
  const alternatives = (question.alternatives?.length ? question.alternatives : question.itens || []).map((item, index) => ({ label: alternativeLabel(item, index), text: alternativeText(item), assets: (item as any).assets as QuestionAsset[] | undefined, index }));
  const supportContexts = (question.contexts || []).filter((context) => Boolean(context.body || context.bodyClean || context.assets?.length));
  const contextAssetIds = new Set(supportContexts.flatMap((context) => context.assets || []).map((asset) => String(asset.tempId || asset.id || "")).filter(Boolean));
  const associatedAssets: QuestionAsset[] = (question.assets || []).filter((asset) => (asset.usage === "support" || asset.usage === "context") && !contextAssetIds.has(String(asset.tempId || asset.id || "")));
  const statementAssets: QuestionAsset[] = (question.assets || []).filter((asset) => !asset.usage || asset.usage === "statement");
  if (!statementAssets.length && question.imageUrl) statementAssets.push({ tempId: "legacy_statement_image", type: "image", usage: "statement", url: question.imageUrl, alt: "Imagem do enunciado", order: 1 });
  const legacySupportText = supportContexts.length ? "" : String(question.introText || "").trim();
  const hasAssociatedText = supportContexts.length > 0 || Boolean(legacySupportText) || associatedAssets.length > 0;
  const correctOption = resolveCorrect(question);
  const selectedCorrect = answered && selected !== null && correctOption === selected;
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 24 : 0) + spacing[2];
  const hasAnswerContent = correctOption !== undefined || Boolean(question.detailedComment?.trim()) || question.hasDetailedComment === true;
  const hasTeacherContent = Boolean(question.teacherComment?.trim()) || question.hasTeacherComment === true;
  const reportedCommentsCount = Number(question.commentsCount);
  const discussionCount = Math.max(
    Number.isFinite(reportedCommentsCount) ? reportedCommentsCount : 0,
    countComments(question.comments),
  );

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" />
      <QuestionHeader index={position} total={total} progress={progress} bookmarked={bookmarked} onBack={handleBack} onToggleBookmark={() => void toggleBookmark()} onReport={reportQuestion} reportPending={hasPendingReport} theme={theme} />
      <Animated.View style={[styles.questionBody, { opacity, transform: [{ translateX: translation }] }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing[6] }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <QuestionMetadata summary={summary} items={metadata} expanded={metadataExpanded} onToggle={() => setMetadataExpanded((value) => !value)} theme={theme} />
          {hasAssociatedText ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: associatedTextExpanded }} onPress={() => setAssociatedTextExpanded((value) => !value)} style={({ pressed }) => [styles.associatedTextToggle, pressed && styles.pressed]}>
            <View style={styles.associatedTextIcon}><Ionicons name="document-text-outline" size={17} color={theme.primary} /></View>
            <Text style={styles.associatedTextToggleLabel}>{associatedTextExpanded ? "Ocultar texto associado" : "Mostrar texto associado"}</Text>
            <Ionicons name={associatedTextExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.primary} />
          </Pressable> : null}
          {associatedTextExpanded ? <View style={styles.associatedTextPanel}>
            {supportContexts.map((context, index) => <View key={context.tempId || context.id || `context-${index}`} style={styles.supportContent}><QuestionRichContent value={context.body || context.bodyClean} assets={context.assets || []} textStyle={styles.statement} /></View>)}
            {legacySupportText || associatedAssets.length ? <View style={styles.supportContent}><QuestionRichContent value={legacySupportText} assets={associatedAssets} textStyle={styles.statement} /></View> : null}
          </View> : null}
          <View style={styles.statementBlock}><Text style={styles.questionLabel}>Enunciado</Text><QuestionRichContent value={question.enunciado || question.enunciado_clean || "Enunciado indisponível."} assets={statementAssets} textStyle={styles.statement} /></View>
          <View style={styles.options}>{alternatives.map((alternative) => { const wrong = answered && selected === alternative.index && !selectedCorrect; const correct = answered && correctOption === alternative.index; return <QuestionOption key={`${alternative.label}-${alternative.index}`} letter={alternative.label} text={alternative.text} assets={alternative.assets} selected={selected === alternative.index} answered={answered} correct={correct} wrong={wrong} onPress={() => setSelected(alternative.index)} theme={theme} />; })}</View>
          <QuestionDetailsActions answered={answered} selectedCorrect={selectedCorrect} hasAnswerContent={hasAnswerContent} hasTeacherContent={hasTeacherContent} discussionCount={discussionCount} onOpenSection={openQuestionSection} theme={theme} styles={styles} />
        </ScrollView>
      </Animated.View>
      <View style={{ paddingBottom: bottomInset }}><QuestionBottomActions answered={answered} selected={selected !== null} loading={answerMutation.isPending || questionQuery.isFetching} canPrevious={canPrevious} canNext={canNext} onConfirm={() => void submitAnswer()} onPrevious={goPrevious} onNext={goNext} theme={theme} /></View>
      <AnimatedModal mode="sheet" onRequestClose={closeReportModal} transparent visible={reportModalVisible}>
        <View style={styles.reportBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar formulário de denúncia" disabled={reportSubmitting} onPress={closeReportModal} style={styles.reportBackdropDismiss} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", width: "100%" }}>
            <View style={[styles.reportSheet, { paddingBottom: Math.max(insets.bottom, spacing[4]) + spacing[2] }]}>
              <View style={styles.reportHandle} />
              <Text style={styles.reportTitle}>Reportar questão</Text>
              <Text style={styles.reportDescription}>Selecione o motivo e explique o que precisa ser corrigido. A denúncia só será enviada quando você confirmar.</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[3] }}>
                <Text style={styles.reportFieldLabel}>Motivo <Text style={styles.reportRequired}>*</Text></Text>
                <View style={styles.reportReasonList}>
                  {QUESTION_REPORT_REASONS.map((reason) => {
                    const selectedReason = reportReason === reason;
                    return <Pressable key={reason} accessibilityRole="radio" accessibilityState={{ checked: selectedReason }} onPress={() => setReportReason(reason)} style={({ pressed }) => [styles.reportReason, selectedReason && styles.reportReasonSelected, pressed && styles.pressed]}>
                      <View style={[styles.reportRadio, selectedReason && styles.reportRadioSelected]}>{selectedReason ? <View style={styles.reportRadioDot} /> : null}</View>
                      <Text style={[styles.reportReasonText, selectedReason && styles.reportReasonTextSelected]}>{reason}</Text>
                    </Pressable>;
                  })}
                </View>
                <Text style={styles.reportFieldLabel}>Detalhes <Text style={styles.reportRequired}>*</Text></Text>
                <TextInput accessibilityLabel="Detalhes da denúncia" editable={!reportSubmitting} maxLength={5000} multiline onChangeText={setReportDetails} placeholder="Descreva o problema para ajudar nossa equipe a analisar." placeholderTextColor={theme.textSubtle} style={styles.reportDetailsInput} value={reportDetails} />
              </ScrollView>
              <View style={styles.reportFooter}>
                <Pressable accessibilityRole="button" disabled={reportSubmitting} onPress={closeReportModal} style={({ pressed }) => [styles.reportCancel, pressed && styles.pressed]}><Text style={styles.reportCancelText}>Cancelar</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: reportSubmitting || !reportReason || !reportDetails.trim() }} disabled={reportSubmitting || !reportReason || !reportDetails.trim()} onPress={() => void submitQuestionReport()} style={({ pressed }) => [styles.reportSubmit, (reportSubmitting || !reportReason || !reportDetails.trim()) && styles.disabled, pressed && styles.pressed]}>
                  {reportSubmitting ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.reportSubmitText}>Enviar denúncia</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </AnimatedModal>
      <GuestAccessSheet
        visible={guestAccessVisible}
        description={guestAccessDescription}
        onDismiss={() => setGuestAccessVisible(false)}
      />
    </View>
  );
}

type QuestionDetailsActionsProps = {
  answered: boolean;
  selectedCorrect: boolean;
  hasAnswerContent: boolean;
  hasTeacherContent: boolean;
  discussionCount: number;
  onOpenSection: (section: "answer" | "teacher" | "stats" | "discussion") => void;
  theme: ResolvedAppTheme;
  styles: ReturnType<typeof createStyles>;
};

const QuestionDetailsActions: React.FC<QuestionDetailsActionsProps> = ({ answered, selectedCorrect, hasAnswerContent, hasTeacherContent, discussionCount, onOpenSection, theme, styles }) => (
  <>
    {answered ? <View style={[styles.resultBanner, selectedCorrect ? styles.resultCorrect : styles.resultWrong]}><Ionicons name={selectedCorrect ? "checkmark-circle" : "close-circle"} size={25} color={selectedCorrect ? theme.success : theme.danger} /><View style={styles.resultCopy}><Text style={styles.resultTitle}>{selectedCorrect ? "Resposta correta" : "Resposta incorreta"}</Text><Text style={styles.panelBody}>{selectedCorrect ? "Você acertou esta questão." : "Confira o gabarito e a explicação abaixo."}</Text></View></View> : null}
    <View style={styles.detailActions}>
      {([
        ["answer", "book-outline", "Gabarito", hasAnswerContent],
        ["teacher", "school-outline", "Professor", hasTeacherContent],
        ["stats", "bar-chart-outline", "Estatísticas", true],
        ["discussion", "chatbubbles-outline", "Discussão", true],
      ] as const).map(([section, icon, title, available]) => <Pressable key={section} accessibilityRole="button" accessibilityState={{ disabled: !available }} disabled={!available} onPress={() => onOpenSection(section)} style={({ pressed }) => [styles.detailAction, !available && styles.detailActionDisabled, pressed && available && styles.pressed]}>
        <View style={[styles.detailActionIcon, !available && styles.detailActionIconDisabled]}><Ionicons name={icon} size={14} color={available ? theme.primary : theme.textSubtle} /></View>
        <View style={styles.detailActionCopy}>
          <Text numberOfLines={1} style={[styles.detailActionTitle, !available && styles.detailActionTitleDisabled]}>{title}</Text>
          {section === "discussion" ? <View style={styles.discussionCount}><Text style={styles.discussionCountText}>{discussionCount}</Text></View> : null}
        </View>
      </Pressable>)}
    </View>
  </>
);

const QuestionSkeleton = ({ theme }: { theme: ResolvedAppTheme }) => { const styles = createStyles(theme); return <View style={styles.screen}><StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" /><View style={styles.errorHeader}><View style={styles.iconButton}><Ionicons name="arrow-back" size={25} color={theme.text} /></View><Text style={styles.errorHeaderTitle}>Questão</Text><View style={styles.iconButton} /></View><View style={styles.skeleton}><View style={[styles.skeletonLine, { width: "70%" }]} /><View style={[styles.skeletonLine, { width: "42%" }]} /><View style={[styles.skeletonLine, { height: 96, width: "100%" }]} /><View style={styles.skeletonOption} /><View style={styles.skeletonOption} /><View style={styles.skeletonOption} /></View></View>; };
const QuestionError = ({ theme, onBack, onRetry }: { theme: ResolvedAppTheme; onBack: () => void; onRetry: () => void }) => { const styles = createStyles(theme); return <View style={styles.errorScreen}><StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" /><View style={styles.errorHeader}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={25} color={theme.text} /></Pressable><Text style={styles.errorHeaderTitle}>Questão</Text><View style={styles.iconButton} /></View><Ionicons name="alert-circle-outline" size={46} color={theme.danger} /><Text style={styles.errorTitle}>Questão indisponível</Text><Text style={styles.errorBody}>Não foi possível carregar esta questão do banco oficial.</Text><Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>; };
