import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useQuestionCommentsQuery,
  useQuestionHistoryQuery,
  useQuestionStatsQuery,
} from '@/features/questions/api/useQuestionDetailsQueries';
import {
  useAddQuestionCommentMutation,
  useLikeQuestionCommentMutation,
} from '@/features/questions/api/useQuestionCommentsMutations';
import {
  useDeleteQuestionNoteMutation,
  useQuestionNotesQuery,
  useSaveQuestionNoteMutation,
} from '@/features/questions/api/useQuestionNotesQuery';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { QuestionComment } from '@/types/comments';
import type { Question } from '@/types/questions';

type Section = 'teacher' | 'detailed' | 'comments' | 'notes' | 'stats' | 'history' | null;

type Props = {
  question: Question;
  userId?: string;
  userName?: string;
};

const cleanText = (value?: string | null): string => (
  String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
);

const formatTimestamp = (value?: number): string => {
  if (!value) return 'Data indisponivel';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';
  return date.toLocaleString('pt-BR');
};

const CommentTree: React.FC<{
  comments: QuestionComment[];
  onLike: (commentId: string) => void;
  depth?: number;
}> = ({ comments, onLike, depth = 0 }) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.commentList}>
      {comments.map((comment) => (
        <View key={comment.id} style={[styles.comment, depth > 0 && styles.commentReply]}>
          <Text style={styles.commentAuthor}>{comment.userName || 'Usuario'}</Text>
          <Text style={styles.bodyText}>{comment.text}</Text>
          <View style={styles.commentMetaRow}>
            <Text style={styles.mutedText}>{comment.date || ''}</Text>
            <Pressable onPress={() => onLike(comment.id)}>
              <Text style={styles.linkText}>{comment.isLiked ? 'Curtido' : 'Curtir'} · {Number(comment.likes || 0)}</Text>
            </Pressable>
          </View>
          {comment.replies?.length ? (
            <CommentTree comments={comment.replies} onLike={onLike} depth={depth + 1} />
          ) : null}
        </View>
      ))}
    </View>
  );
};

export const QuestionDetailsPanel: React.FC<Props> = ({ question, userId, userName }) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [section, setSection] = React.useState<Section>(null);
  const [commentDraft, setCommentDraft] = React.useState('');
  const [noteDraft, setNoteDraft] = React.useState('');
  const questionId = question.id;
  const answered = question.userAnswer?.selectedOptionIndex !== undefined;

  const statsQuery = useQuestionStatsQuery(questionId, section === 'stats');
  const historyQuery = useQuestionHistoryQuery(questionId, userId, section === 'history');
  const commentsQuery = useQuestionCommentsQuery(questionId, userId, section === 'comments');
  const notesQuery = useQuestionNotesQuery(userId);
  const addCommentMutation = useAddQuestionCommentMutation(questionId, userId, userName);
  const likeCommentMutation = useLikeQuestionCommentMutation(questionId, userId);
  const saveNoteMutation = useSaveQuestionNoteMutation(userId);
  const deleteNoteMutation = useDeleteQuestionNoteMutation(userId);

  const currentNote = React.useMemo(
    () => notesQuery.data?.find((note) => Number(note.questionId) === Number(questionId)),
    [notesQuery.data, questionId],
  );

  React.useEffect(() => {
    if (section === 'notes') {
      setNoteDraft(currentNote?.text || '');
    }
  }, [currentNote?.text, section]);

  const toggle = (next: Section) => setSection((current) => current === next ? null : next);

  const submitComment = async () => {
    try {
      await addCommentMutation.mutateAsync({ content: commentDraft });
      setCommentDraft('');
    } catch (error: any) {
      Alert.alert('Comentarios', error?.message || 'Nao foi possivel publicar o comentario.');
    }
  };

  const likeComment = async (commentId: string) => {
    try {
      await likeCommentMutation.mutateAsync(commentId);
    } catch (error: any) {
      Alert.alert('Comentarios', error?.message || 'Nao foi possivel curtir o comentario.');
    }
  };

  const saveNote = async () => {
    if (!questionId) return;
    try {
      await saveNoteMutation.mutateAsync({ questionId, text: noteDraft, previous: currentNote });
    } catch (error: any) {
      Alert.alert('Anotacao', error?.message || 'Nao foi possivel salvar a anotacao.');
    }
  };

  const deleteNote = async () => {
    if (!currentNote) return;
    try {
      await deleteNoteMutation.mutateAsync(currentNote);
      setNoteDraft('');
    } catch (error: any) {
      Alert.alert('Anotacao', error?.message || 'Nao foi possivel remover a anotacao.');
    }
  };

  const actions: Array<{ key: Section; label: string; visible: boolean }> = [
    { key: 'teacher', label: 'Professor', visible: Boolean(question.hasTeacherComment || question.teacherComment) },
    { key: 'detailed', label: 'Analise', visible: Boolean(question.hasDetailedComment || question.detailedComment) },
    { key: 'comments', label: `Comentarios${question.commentsCount ? ` (${question.commentsCount})` : ''}`, visible: true },
    { key: 'notes', label: currentNote?.text ? 'Anotacao' : 'Anotar', visible: Boolean(userId) },
    { key: 'stats', label: 'Estatisticas', visible: true },
    { key: 'history', label: 'Historico', visible: answered && Boolean(userId) },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        {actions.filter((item) => item.visible).map((action) => {
          const active = section === action.key;
          return (
            <Pressable
              key={String(action.key)}
              onPress={() => toggle(action.key)}
              style={({ pressed }) => [styles.action, active && styles.actionActive, pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, active && styles.actionTextActive]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'teacher' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Comentario do professor</Text>
          <Text style={styles.bodyText}>{cleanText(question.teacherComment) || 'Comentario ainda nao disponivel.'}</Text>
        </View>
      ) : null}

      {section === 'detailed' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Analise detalhada</Text>
          <Text style={styles.bodyText}>{cleanText(question.detailedComment) || 'Analise ainda nao disponivel.'}</Text>
        </View>
      ) : null}

      {section === 'stats' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Estatisticas</Text>
          {statsQuery.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
          {statsQuery.isError ? <Text style={styles.errorText}>Nao foi possivel carregar as estatisticas.</Text> : null}
          {statsQuery.data ? (
            <View style={styles.metricRow}>
              <View style={styles.metric}><Text style={styles.metricValue}>{statsQuery.data.totalAttempts}</Text><Text style={styles.mutedText}>respostas</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{statsQuery.data.correctCount}</Text><Text style={styles.mutedText}>acertos</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{statsQuery.data.wrongCount}</Text><Text style={styles.mutedText}>erros</Text></View>
            </View>
          ) : null}
        </View>
      ) : null}

      {section === 'history' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Seu historico</Text>
          {historyQuery.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
          {historyQuery.isError ? <Text style={styles.errorText}>Nao foi possivel carregar o historico.</Text> : null}
          {historyQuery.data?.length === 0 ? <Text style={styles.mutedText}>Nenhuma tentativa anterior encontrada.</Text> : null}
          {historyQuery.data?.map((entry, index) => (
            <View key={`${entry.timestamp}-${index}`} style={styles.historyRow}>
              <Text style={entry.isCorrect ? styles.successText : styles.errorText}>
                {entry.isCorrect ? 'Acerto' : 'Erro'} · alternativa {String.fromCharCode(65 + Number(entry.selectedOptionIndex || 0))}
              </Text>
              <Text style={styles.mutedText}>{formatTimestamp(entry.timestamp)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {section === 'comments' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Comentarios</Text>
          {commentsQuery.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
          {commentsQuery.isError ? <Text style={styles.errorText}>Nao foi possivel carregar os comentarios.</Text> : null}
          {commentsQuery.data?.length === 0 ? <Text style={styles.mutedText}>Ainda nao ha comentarios nesta questao.</Text> : null}
          {commentsQuery.data?.length ? <CommentTree comments={commentsQuery.data} onLike={(id) => void likeComment(id)} /> : null}
          {userId ? (
            <View style={styles.editorBlock}>
              <TextInput
                multiline
                onChangeText={setCommentDraft}
                placeholder="Escreva um comentario"
                placeholderTextColor={theme.textSubtle}
                style={styles.textArea}
                value={commentDraft}
              />
              <Pressable
                disabled={addCommentMutation.isPending || !commentDraft.trim()}
                onPress={() => void submitComment()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{addCommentMutation.isPending ? 'Publicando...' : 'Publicar'}</Text>
              </Pressable>
            </View>
          ) : <Text style={styles.mutedText}>Entre na sua conta para participar.</Text>}
        </View>
      ) : null}

      {section === 'notes' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Minha anotacao</Text>
          {notesQuery.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
          <TextInput
            multiline
            onChangeText={setNoteDraft}
            placeholder="Registre um ponto importante desta questao"
            placeholderTextColor={theme.textSubtle}
            style={styles.textArea}
            value={noteDraft}
          />
          <View style={styles.editorActions}>
            <Pressable
              disabled={saveNoteMutation.isPending || !noteDraft.trim()}
              onPress={() => void saveNote()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{saveNoteMutation.isPending ? 'Salvando...' : 'Salvar'}</Text>
            </Pressable>
            {currentNote ? (
              <Pressable disabled={deleteNoteMutation.isPending} onPress={() => void deleteNote()} style={styles.secondaryButton}>
                <Text style={styles.dangerText}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: { gap: spacing[3], marginTop: spacing[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  action: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  actionActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  actionText: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  actionTextActive: { color: theme.primary },
  panel: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[3], padding: spacing[4] },
  panelTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  bodyText: { color: theme.text, fontSize: typography.size.sm, lineHeight: 20 },
  mutedText: { color: theme.textMuted, fontSize: typography.size.xs },
  linkText: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  errorText: { color: theme.danger, fontSize: typography.size.xs },
  dangerText: { color: theme.danger, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  successText: { color: theme.success, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  metricRow: { flexDirection: 'row', gap: spacing[2] },
  metric: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.md, flex: 1, gap: spacing[1], padding: spacing[3] },
  metricValue: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  historyRow: { borderBottomColor: theme.border, borderBottomWidth: 1, gap: spacing[1], paddingVertical: spacing[2] },
  commentList: { gap: spacing[3] },
  comment: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.md, gap: spacing[1], padding: spacing[3] },
  commentReply: { marginLeft: spacing[3], marginTop: spacing[2] },
  commentAuthor: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  commentMetaRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  editorBlock: { gap: spacing[2] },
  editorActions: { alignItems: 'center', flexDirection: 'row', gap: spacing[2] },
  textArea: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, fontSize: typography.size.sm, minHeight: 88, padding: spacing[3], textAlignVertical: 'top' },
  primaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: theme.primary, borderRadius: radius.md, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[4] },
  primaryButtonText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  secondaryButton: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  pressed: { opacity: 0.72 },
});

export default QuestionDetailsPanel;
