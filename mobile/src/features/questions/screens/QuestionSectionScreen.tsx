import React from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuestionCommentsPanel } from "@/components/questions/QuestionCommentsPanel";
import { QuestionRichContent } from "@/components/questions/QuestionRichContent";
import { GuestAccessSheet } from "@/components/GuestAccessSheet";
import { useQuestionCommentsQuery, useQuestionStatsQuery } from "@/features/questions/api/useQuestionDetailsQueries";
import { useAddQuestionCommentMutation, useDeleteQuestionCommentMutation, useLikeQuestionCommentMutation } from "@/features/questions/api/useQuestionCommentsMutations";
import { questionService } from "@/services/questions/questionService";
import { reportsService } from "@/services/reports/reportsService";
import { useAuth } from "@/providers/AuthProvider";
import { darkTheme, palette, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

type Section = "answer" | "teacher" | "stats" | "discussion";
const sectionInfo: Record<Section, { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  answer: { title: "Gabarito", icon: "book-outline" },
  teacher: { title: "Comentário do professor", icon: "school-outline" },
  stats: { title: "Estatísticas", icon: "bar-chart-outline" },
  discussion: { title: "Discussão", icon: "chatbubbles-outline" },
};
const sectionKeys = Object.keys(sectionInfo) as Section[];
export default function QuestionSectionScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[]; section?: string | string[]; selectedCorrect?: string | string[]; selectedOption?: string | string[]; answered?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const section = sectionKeys.includes(rawSection as Section) ? rawSection as Section : "answer";
  const selectedCorrect = (Array.isArray(params.selectedCorrect) ? params.selectedCorrect[0] : params.selectedCorrect) === "true";
  const selectedOption = Number(Array.isArray(params.selectedOption) ? params.selectedOption[0] : params.selectedOption);
  const answered = (Array.isArray(params.answered) ? params.answered[0] : params.answered) === "true";
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user?.id;
  const [draft, setDraft] = React.useState("");
  const [commentToDelete, setCommentToDelete] = React.useState<string | null>(null);
  const questionQuery = useQuery({
    queryKey: ["questions", "section", id],
    queryFn: async () => (await questionService.getQuestionPage({ questionIds: [id as string], page: 1, limit: 1 })).rows[0] || null,
    enabled: Boolean(id) && !isVisitor,
    staleTime: 60_000,
  });
  const question = questionQuery.data;
  const statsQuery = useQuestionStatsQuery(id, section === "stats" && !isVisitor);
  const commentsQuery = useQuestionCommentsQuery(id, user?.id, section === "discussion" && !isVisitor);
  const addCommentMutation = useAddQuestionCommentMutation(id, user?.id, user?.name, user?.photoUrl, user?.plan);
  const likeCommentMutation = useLikeQuestionCommentMutation(id, user?.id);
  const deleteCommentMutation = useDeleteQuestionCommentMutation(id, user?.id);
  const correctOption = question?.correctOptionIndex ?? (question?.resposta !== undefined ? (Number(question.resposta) > 0 ? Number(question.resposta) - 1 : Number(question.resposta)) : undefined);
  const total = statsQuery.data?.totalAttempts ?? question?.stats?.totalAttempts ?? 0;
  const correct = statsQuery.data?.correctCount ?? question?.stats?.correctCount ?? 0;
  const wrong = statsQuery.data?.wrongCount ?? question?.stats?.wrongCount ?? Math.max(0, total - correct);
  const accuracy = total ? Math.round(correct / total * 100) : 0;

  if (isVisitor) {
    const sectionCopy: Record<Section, string> = {
      answer: "Entre ou crie sua conta para ver o gabarito e a resolução da questão.",
      teacher: "Entre ou crie sua conta para acessar o comentário do professor.",
      stats: "Entre ou crie sua conta para consultar as estatísticas da questão.",
      discussion: "Entre ou crie sua conta para acessar a discussão da questão.",
    };
    return (
      <View style={styles.screen}>
        <StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" />
        <GuestAccessSheet
          visible
          description={sectionCopy[section]}
          onDismiss={() => router.canGoBack() ? router.back() : router.replace("/questoes")}
        />
      </View>
    );
  }

  const closeDeleteComment = () => {
    if (!deleteCommentMutation.isPending) setCommentToDelete(null);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete || deleteCommentMutation.isPending) return;
    try {
      await deleteCommentMutation.mutateAsync(commentToDelete);
      setCommentToDelete(null);
    } catch (error: any) {
      Alert.alert("Comentários", error?.message || "Não foi possível excluir o comentário.");
    }
  };

  const sendCommentReport = (commentId: string, reason: string) => reportsService.createReport({ targetType: "comment", targetId: commentId, reason, details: "Denúncia enviada pelo aplicativo mobile." }).then(() => Alert.alert("Denúncia enviada", "A equipe analisará este comentário."))
    .catch((error: any) => Alert.alert("Não foi possível denunciar", error?.message || "Tente novamente em instantes."));

  if (questionQuery.isPending || !question) {
    if (questionQuery.isError) return <View style={styles.center}><StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" /><Text style={styles.errorTitle}>Não foi possível abrir esta seção</Text><Pressable onPress={() => void questionQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>;
    return <View style={styles.center}><StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" /><ActivityIndicator color={theme.primary} /></View>;
  }

  return <View style={styles.screen}>
    <StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar para a questão" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
      <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>{sectionInfo[section].title}</Text><Text style={styles.headerSubtitle}>Questão {question.id}</Text></View>
      <View style={styles.headerIcon}><Ionicons name={sectionInfo[section].icon} size={21} color={theme.primary} /></View>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {section === "answer" ? <View style={styles.panel}>
        <Text style={styles.panelTitle}>Gabarito comentado</Text>
        <View style={styles.correctCard}><Ionicons name="checkmark-circle" size={21} color={theme.success} /><Text style={styles.correctText}>Alternativa correta: {correctOption === undefined ? "indisponível" : String.fromCharCode(65 + correctOption)}</Text></View>
        {question.detailedComment ? <QuestionRichContent value={question.detailedComment} textStyle={styles.body} /> : <Text style={styles.body}>A resolução detalhada não está disponível para esta questão.</Text>}
      </View> : null}
      {section === "teacher" ? <View style={styles.panel}>
        <View style={styles.sectionHeading}><View style={styles.avatar}><Ionicons name="school-outline" size={21} color={theme.primary} /></View><Text style={styles.panelTitle}>Comentário do professor</Text></View>
        {question.teacherComment ? <QuestionRichContent value={question.teacherComment} textStyle={styles.body} /> : <Text style={styles.body}>Esta questão não possui comentário do professor disponível.</Text>}
      </View> : null}
      {section === "stats" ? <View style={styles.panel}>
        <View style={styles.sectionHeading}><Text style={styles.panelTitle}>Desempenho da questão</Text>{statsQuery.isFetching ? <ActivityIndicator size="small" color={theme.primary} /> : null}</View>
        {statsQuery.isError ? <View><Text style={styles.body}>Não foi possível carregar as estatísticas.</Text><Pressable onPress={() => void statsQuery.refetch()}><Text style={styles.link}>Tentar novamente</Text></Pressable></View> : <>
          <View style={styles.statsGrid}><Metric label="Respostas" value={String(total)} styles={styles} /><Metric label="Acertos" value={`${accuracy}%`} styles={styles} /><Metric label="Corretas" value={String(correct)} styles={styles} /><Metric label="Incorretas" value={String(wrong)} styles={styles} /></View>
          <Text style={styles.distributionTitle}>Alternativas selecionadas</Text>
          {(question.alternatives?.length ? question.alternatives : question.itens || []).map((alternative, index) => {
            const rawAlternative = alternative as typeof alternative & { label?: string };
            const key = String(rawAlternative.label || alternative.rotulo || String.fromCharCode(65 + index));
            const count = Number(statsQuery.data?.optionDistribution?.[key] || 0);
            const share = total ? Math.round(count / total * 100) : 0;
            return <View key={`${key}-${index}`} style={styles.statRow}><Text style={styles.statLabel}>{key}</Text><View style={styles.track}><View style={[styles.fill, { width: `${share}%` }]} /></View><Text style={styles.statValue}>{share}%</Text></View>;
          })}
        </>}
      </View> : null}
      {section === "discussion" ? <QuestionCommentsPanel comments={commentsQuery.data || []} loading={commentsQuery.isLoading} draft={draft} currentUserId={user?.id} canComment={Boolean(user?.id)} submitting={addCommentMutation.isPending || likeCommentMutation.isPending || deleteCommentMutation.isPending} onChangeDraft={setDraft} onSubmitComment={async (content, parentId) => { try { await addCommentMutation.mutateAsync({ content, parentId }); setDraft(""); } catch (error: any) { Alert.alert("Comentários", error?.message || "Não foi possível publicar o comentário."); } }} onLikeComment={async (commentId) => { try { await likeCommentMutation.mutateAsync(commentId); } catch (error: any) { Alert.alert("Comentários", error?.message || "Não foi possível curtir o comentário."); } }} onDeleteComment={setCommentToDelete} onReportComment={(commentId) => new Promise<void>((resolve) => Alert.alert("Reportar comentário", "Selecione o motivo da denúncia.", [
        { text: "Conteúdo inadequado", onPress: () => { void sendCommentReport(commentId, "Conteúdo inadequado").finally(() => resolve()); } },
        { text: "Informação incorreta", onPress: () => { void sendCommentReport(commentId, "Informação incorreta").finally(() => resolve()); } },
        { text: "Cancelar", style: "cancel", onPress: () => resolve() },
      ], { cancelable: true, onDismiss: resolve }))} /> : null}
      {section === "discussion" && commentsQuery.isError ? <Pressable onPress={() => void commentsQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Tentar carregar comentários novamente</Text></Pressable> : null}
      {answered ? <View style={styles.answerSummary}><Ionicons name={selectedCorrect ? "checkmark-circle" : "close-circle"} size={19} color={selectedCorrect ? theme.success : theme.danger} /><Text style={styles.answerSummaryText}>Sua resposta nesta tentativa: {selectedCorrect ? "correta" : selectedOption >= 0 ? `alternativa ${String.fromCharCode(65 + selectedOption)}` : "incorreta"}</Text></View> : null}
    </ScrollView>
    <Modal animationType="slide" transparent visible={Boolean(commentToDelete)} onRequestClose={closeDeleteComment}>
      <View style={styles.deleteBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar confirmação de exclusão" disabled={deleteCommentMutation.isPending} onPress={closeDeleteComment} style={styles.deleteBackdropDismiss} />
        <View style={[styles.deleteSheet, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <View style={styles.deleteHandle} />
          <View style={styles.deleteIcon}><Ionicons name="trash-outline" size={22} color={theme.danger} /></View>
          <Text style={styles.deleteTitle}>Excluir comentário?</Text>
          <Text style={styles.deleteMessage}>Essa ação não pode ser desfeita. Deseja excluir seu comentário?</Text>
          <View style={styles.deleteActions}>
            <Pressable accessibilityRole="button" disabled={deleteCommentMutation.isPending} onPress={closeDeleteComment} style={({ pressed }) => [styles.deleteCancelButton, pressed && styles.pressed]}>
              <Text style={styles.deleteCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={deleteCommentMutation.isPending} onPress={() => void confirmDeleteComment()} style={({ pressed }) => [styles.deleteConfirmButton, deleteCommentMutation.isPending && styles.disabled, pressed && styles.pressed]}>
              {deleteCommentMutation.isPending ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.deleteConfirmText}>Excluir comentário</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

const Metric = ({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) => <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  header: { alignItems: "center", backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 66, paddingBottom: spacing[3], paddingHorizontal: spacing[4] },
  back: { alignItems: "center", height: 42, justifyContent: "center", width: 42 },
  headerTitleWrap: { flex: 1, gap: 2, paddingLeft: spacing[2] },
  headerTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  headerSubtitle: { color: theme.textMuted, fontSize: typography.size.xs },
  headerIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.md, height: 40, justifyContent: "center", width: 40 },
  content: { gap: spacing[4], padding: spacing[5] },
  panel: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[4], padding: spacing[4] },
  panelTitle: { color: theme.text, flex: 1, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  sectionHeading: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  avatar: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.pill, height: 42, justifyContent: "center", width: 42 },
  body: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 22 },
  correctCard: { alignItems: "center", backgroundColor: theme.successSubtle, borderRadius: radius.md, flexDirection: "row", gap: spacing[2], padding: spacing[3] },
  correctText: { color: theme.success, flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  metric: { backgroundColor: theme.background, borderRadius: radius.md, flexBasis: "47%", flexGrow: 1, gap: 3, padding: spacing[3] },
  metricValue: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  metricLabel: { color: theme.textMuted, fontSize: typography.size.xs },
  distributionTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold, marginTop: spacing[2] },
  statRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  statLabel: { color: theme.textMuted, fontSize: typography.size.xs, width: 24 },
  track: { backgroundColor: theme.background, borderRadius: radius.pill, flex: 1, height: 9, overflow: "hidden" },
  fill: { backgroundColor: theme.primary, borderRadius: radius.pill, height: "100%" },
  statValue: { color: theme.text, fontSize: 10, textAlign: "right", width: 36 },
  answerSummary: { alignItems: "center", flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[1] },
  answerSummaryText: { color: theme.textMuted, flex: 1, fontSize: typography.size.xs },
  link: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold, marginTop: spacing[2] },
  retry: { alignItems: "center", backgroundColor: theme.primary, borderRadius: radius.button, minHeight: 46, justifyContent: "center", paddingHorizontal: spacing[4] },
  retryText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.74 },
  deleteBackdrop: { backgroundColor: "rgba(10,10,35,0.56)", flex: 1, justifyContent: "flex-end" },
  deleteBackdropDismiss: { ...StyleSheet.absoluteFill },
  deleteSheet: { ...(theme === darkTheme ? shadows.modalDark : shadows.modal), alignItems: "center", backgroundColor: theme.surface, borderTopLeftRadius: radius.dialog, borderTopRightRadius: radius.dialog, gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  deleteHandle: { alignSelf: "center", backgroundColor: theme.borderStrong, borderRadius: radius.pill, height: 4, marginBottom: spacing[1], width: 40 },
  deleteIcon: { alignItems: "center", backgroundColor: theme.dangerSubtle, borderRadius: radius.pill, height: 48, justifyContent: "center", width: 48 },
  deleteTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  deleteMessage: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 21, textAlign: "center" },
  deleteActions: { alignSelf: "stretch", flexDirection: "row", gap: spacing[3], marginTop: spacing[2] },
  deleteCancelButton: { alignItems: "center", borderColor: theme.border, borderRadius: radius.button, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  deleteCancelText: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  deleteConfirmButton: { alignItems: "center", backgroundColor: theme.danger, borderRadius: radius.button, flex: 1.3, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3] },
  deleteConfirmText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  center: { alignItems: "center", backgroundColor: theme.background, flex: 1, gap: spacing[3], justifyContent: "center", padding: spacing[6] },
  errorTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: "center" },
});
