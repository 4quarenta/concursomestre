import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';
import type { QuestionComment } from '@/types/comments';

type QuestionCommentsPanelProps = {
  comments: QuestionComment[];
  loading: boolean;
  draft: string;
  submitting: boolean;
  onChangeDraft: (value: string) => void;
  onSubmitComment: (content: string, parentId?: string) => Promise<void> | void;
  onLikeComment: (commentId: string) => Promise<void> | void;
};

type CommentItemProps = {
  comment: QuestionComment;
  depth?: number;
  onSubmitComment: (content: string, parentId?: string) => Promise<void> | void;
  onLikeComment: (commentId: string) => Promise<void> | void;
  submitting: boolean;
};

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth = 0,
  onSubmitComment,
  onLikeComment,
  submitting,
}) => {
  const [isReplying, setIsReplying] = React.useState(false);
  const [replyDraft, setReplyDraft] = React.useState('');

  const handleSubmitReply = async () => {
    const nextValue = replyDraft.trim();
    if (!nextValue) return;

    await onSubmitComment(nextValue, String(comment.id));
    setReplyDraft('');
    setIsReplying(false);
  };

  return (
    <View style={[styles.commentCard, depth > 0 && styles.commentReplyCard]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentIdentity}>
          <Text style={styles.commentAuthor}>{comment.userName || 'Usuario'}</Text>
          {comment.userPlan ? (
            <Text style={styles.commentPlan}>{comment.userPlan}</Text>
          ) : null}
        </View>
        <Text style={styles.commentDate}>{comment.date || 'Agora'}</Text>
      </View>

      <Text style={styles.commentText}>{comment.text}</Text>

      <View style={styles.commentActions}>
        <Pressable onPress={() => void onLikeComment(String(comment.id))} style={styles.commentActionButton}>
          <Text style={styles.commentActionText}>Curtir ({Number(comment.likes || 0)})</Text>
        </Pressable>
        <Pressable onPress={() => setIsReplying((current) => !current)} style={styles.commentActionButton}>
          <Text style={styles.commentActionText}>{isReplying ? 'Cancelar' : 'Responder'}</Text>
        </Pressable>
      </View>

      {isReplying ? (
        <View style={styles.replyComposer}>
          <TextInput
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="Escreva uma resposta"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.replyInput}
          />
          <Pressable
            onPress={() => void handleSubmitReply()}
            disabled={submitting || replyDraft.trim().length === 0}
            style={[styles.replyButton, (submitting || replyDraft.trim().length === 0) && styles.replyButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.replyButtonText}>Enviar resposta</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {(comment.replies || []).map((reply) => (
        <CommentItem
          key={String(reply.id)}
          comment={reply}
          depth={depth + 1}
          onSubmitComment={onSubmitComment}
          onLikeComment={onLikeComment}
          submitting={submitting}
        />
      ))}
    </View>
  );
};

export const QuestionCommentsPanel: React.FC<QuestionCommentsPanelProps> = ({
  comments,
  loading,
  draft,
  submitting,
  onChangeDraft,
  onSubmitComment,
  onLikeComment,
}) => {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Comunidade</Text>
        <Text style={styles.panelSummary}>{comments.length} topicos</Text>
      </View>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Compartilhe uma duvida ou observacao"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.composerInput}
        />
        <Pressable
          onPress={() => void onSubmitComment(draft)}
          disabled={submitting || draft.trim().length === 0}
          style={[styles.composerButton, (submitting || draft.trim().length === 0) && styles.composerButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.composerButtonText}>Publicar</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando comentarios</Text>
        </View>
      ) : comments.length > 0 ? (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <CommentItem
              key={String(comment.id)}
              comment={comment}
              onSubmitComment={onSubmitComment}
              onLikeComment={onLikeComment}
              submitting={submitting}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nenhum comentario ainda</Text>
          <Text style={styles.emptyText}>Abra a conversa desta questao por aqui.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  panelSummary: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  composer: {
    gap: 8,
  },
  composerInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  composerButton: {
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    minWidth: 120,
    paddingHorizontal: 14,
  },
  composerButtonDisabled: {
    opacity: 0.6,
  },
  composerButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  commentReplyCard: {
    marginLeft: 12,
    backgroundColor: '#F8FAFC',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentIdentity: {
    flex: 1,
    gap: 2,
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  commentPlan: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  commentDate: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  commentText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  commentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commentActionButton: {
    paddingVertical: 2,
  },
  commentActionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  replyComposer: {
    gap: 8,
  },
  replyInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  replyButton: {
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  replyButtonDisabled: {
    opacity: 0.6,
  },
  replyButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default QuestionCommentsPanel;
