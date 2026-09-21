import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getAssetUrl } from "@/services/api/client";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { QuestionComment } from "@/types/comments";

type QuestionCommentsPanelProps = {
  comments: QuestionComment[];
  loading: boolean;
  draft: string;
  submitting: boolean;
  onChangeDraft: (value: string) => void;
  onSubmitComment: (content: string, parentId?: string) => Promise<void> | void;
  onLikeComment: (commentId: string) => Promise<void> | void;
  onReportComment?: (commentId: string) => Promise<void> | void;
  canComment?: boolean;
};

type CommentItemProps = {
  comment: QuestionComment;
  depth: number;
  submitting: boolean;
  canComment: boolean;
  onReply: (comment: QuestionComment) => void;
  onLikeComment: (commentId: string) => Promise<void> | void;
  onReportComment?: (commentId: string) => Promise<void> | void;
  styles: ReturnType<typeof createStyles>;
};

const stripMarkup = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();

const planIcon = (plan: string | undefined): "star" | "flash" | "ribbon" | null => {
  switch (String(plan || "").toLowerCase()) {
    case "elite":
      return "ribbon";
    case "pro":
      return "flash";
    case "essencial":
      return "star";
    default:
      return null;
  }
};

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth,
  submitting,
  canComment,
  onReply,
  onLikeComment,
  onReportComment,
  styles,
}) => {
  const [showReplies, setShowReplies] = React.useState(false);
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const replies = comment.replies || [];
  const avatarUrl = comment.userAvatar ? getAssetUrl(comment.userAvatar) : "";
  const initial = (comment.userName || "A").trim().charAt(0).toUpperCase() || "A";
  const badgeIcon = planIcon(comment.userPlan);
  const role = String(comment.userRole || "").toLowerCase();
  const text = stripMarkup(comment.text || "");

  return (
    <View style={[styles.commentThread, depth > 0 && styles.replyThread]}>
      {depth > 0 ? <View style={styles.replyConnector} /> : null}
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <View style={styles.commentIdentity}>
            <View style={styles.avatar}>
              {avatarUrl && !avatarFailed ? (
                <Image
                  source={{ uri: avatarUrl }}
                  onError={() => setAvatarFailed(true)}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
            <View style={styles.authorCopy}>
              <View style={styles.authorLine}>
                <Text style={styles.commentAuthor} numberOfLines={1}>
                  {comment.userName || "Usuário"}
                </Text>
                {role === "admin" || role === "staff" ? (
                  <Text style={[styles.roleBadge, role === "admin" ? styles.adminBadge : styles.staffBadge]}>
                    {role === "admin" ? "Admin" : "Staff"}
                  </Text>
                ) : null}
                {badgeIcon ? (
                  <Ionicons
                    name={badgeIcon}
                    size={13}
                    color={comment.userPlan === "Elite" ? "#F59E0B" : styles.planIcon.color}
                  />
                ) : null}
              </View>
              <Text style={styles.commentDate}>{comment.date || "Agora"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.commentText}>{text || comment.text}</Text>

        <View style={styles.commentActions}>
          <Pressable
            accessibilityRole="button"
            disabled={!canComment || submitting}
            onPress={() => void onLikeComment(String(comment.id))}
            style={styles.commentAction}
          >
            <Ionicons
              name={comment.isLiked ? "thumbs-up" : "thumbs-up-outline"}
              size={13}
              color={comment.isLiked ? styles.likedAction.color : styles.actionText.color}
            />
            {Number(comment.likes || 0) > 0 ? (
              <Text style={[styles.actionText, comment.isLiked && styles.likedAction]}>
                {Number(comment.likes || 0)}
              </Text>
            ) : null}
          </Pressable>
          {canComment ? (
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => onReply(comment)}
              style={styles.commentAction}
            >
              <Ionicons name="return-down-forward-outline" size={13} color={styles.actionText.color} />
              <Text style={styles.actionText}>Responder</Text>
            </Pressable>
          ) : null}
          {canComment && onReportComment ? (
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void onReportComment(String(comment.id))}
              style={styles.commentAction}
            >
              <Ionicons name="flag-outline" size={12} color={styles.actionText.color} />
              <Text style={styles.actionText}>Reportar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {replies.length > 0 ? (
        <Pressable onPress={() => setShowReplies((current) => !current)} style={styles.repliesToggle}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={styles.toggleText.color} />
          <Text style={styles.toggleText}>
            {showReplies ? "Ocultar" : "Ver"} {replies.length}{" "}
            {replies.length === 1 ? "resposta" : "respostas"}
          </Text>
        </Pressable>
      ) : null}

      {showReplies
        ? replies.map((reply) => (
            <CommentItem
              key={String(reply.id)}
              comment={reply}
              depth={depth + 1}
              submitting={submitting}
              canComment={canComment}
              onReply={onReply}
              onLikeComment={onLikeComment}
              onReportComment={onReportComment}
              styles={styles}
            />
          ))
        : null}
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
  onReportComment,
  canComment = true,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [replyTo, setReplyTo] = React.useState<QuestionComment | null>(null);

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    await onSubmitComment(content, replyTo?.id);
    onChangeDraft("");
    setReplyTo(null);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <Ionicons name="chatbubble-outline" size={15} color={theme.text} />
          <Text style={styles.panelTitle}>Comentários da Comunidade</Text>
        </View>
      </View>

      {canComment ? (
        <View style={styles.composerBlock}>
          {replyTo ? (
            <View style={styles.replyingBanner}>
              <Text style={styles.replyingText} numberOfLines={1}>
                Respondendo a <Text style={styles.replyingName}>{replyTo.userName}</Text>
              </Text>
              <Pressable accessibilityLabel="Cancelar resposta" onPress={() => setReplyTo(null)}>
                <Ionicons name="close-circle-outline" size={16} color={theme.primary} />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Escreva seu comentário..."
            placeholderTextColor={theme.textSubtle}
            multiline
            style={styles.composerInput}
          />
          <View style={styles.composerFooter}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting || draft.trim().length === 0}
              onPress={() => void handleSubmit()}
              style={[styles.publishButton, (submitting || draft.trim().length === 0) && styles.disabledButton]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.publishButtonText}>Publicar</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.loginBox}>
          <Text style={styles.loginText}>Você precisa estar logado para participar da discussão.</Text>
          <Pressable onPress={() => router.push("/login")} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Fazer Login</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.loadingText}>Carregando comentários</Text>
        </View>
      ) : comments.length === 0 ? (
        <Text style={styles.emptyText}>Seja o primeiro a comentar!</Text>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <CommentItem
              key={String(comment.id)}
              comment={comment}
              depth={0}
              submitting={submitting}
              canComment={canComment}
              onReply={setReplyTo}
              onLikeComment={onLikeComment}
              onReportComment={onReportComment}
              styles={styles}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    panel: { backgroundColor: theme.background, gap: spacing[4], paddingVertical: spacing[2] },
    panelHeader: { paddingHorizontal: spacing[1] },
    panelTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
    panelTitle: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
    composerBlock: { gap: spacing[2] },
    replyingBanner: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      maxWidth: "100%",
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    replyingText: { color: theme.primary, flexShrink: 1, fontSize: typography.size.xs },
    replyingName: { fontWeight: typography.weight.bold },
    composerInput: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: theme.text,
      fontSize: typography.size.sm,
      minHeight: 82,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      textAlignVertical: "top",
    },
    composerFooter: { alignItems: "flex-end" },
    publishButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      justifyContent: "center",
      minHeight: 40,
      minWidth: 100,
      paddingHorizontal: spacing[4],
    },
    publishButtonText: {
      color: theme.onPrimary,
      fontSize: 10,
      fontWeight: typography.weight.black,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    disabledButton: { opacity: 0.55 },
    loginBox: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[5],
    },
    loginText: { color: theme.textMuted, fontSize: typography.size.xs, textAlign: "center" },
    loginButton: { backgroundColor: theme.primary, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
    loginButtonText: { color: theme.onPrimary, fontSize: 10, fontWeight: typography.weight.black, textTransform: "uppercase" },
    loadingBlock: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
    loadingText: { color: theme.textMuted, fontSize: typography.size.xs },
    emptyText: { color: theme.textMuted, fontSize: typography.size.xs, fontStyle: "italic", paddingVertical: spacing[2], textAlign: "center" },
    commentsList: { gap: spacing[3] },
    commentThread: { gap: spacing[2] },
    replyThread: { marginLeft: spacing[4], paddingLeft: spacing[3] },
    replyConnector: { backgroundColor: theme.border, height: 1, left: 0, position: "absolute", top: spacing[5], width: spacing[3] },
    commentCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      elevation: 1,
      gap: spacing[2],
      padding: spacing[4],
      shadowColor: theme.text,
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    commentHeader: { alignItems: "center", flexDirection: "row" },
    commentIdentity: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing[2] },
    avatar: { alignItems: "center", backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.pill, borderWidth: 1, height: 28, justifyContent: "center", overflow: "hidden", width: 28 },
    avatarImage: { height: "100%", width: "100%" },
    avatarInitial: { color: theme.textMuted, fontSize: 11, fontWeight: typography.weight.black },
    authorCopy: { flex: 1, gap: 1 },
    authorLine: { alignItems: "center", flexDirection: "row", gap: spacing[1] },
    commentAuthor: { color: theme.text, flexShrink: 1, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
    commentDate: { color: theme.textSubtle, fontSize: 10 },
    roleBadge: { borderRadius: radius.pill, fontSize: 8, fontWeight: typography.weight.black, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 2, textTransform: "uppercase" },
    adminBadge: { backgroundColor: theme.text, color: theme.surface },
    staffBadge: { backgroundColor: theme.primarySubtle, color: theme.primary },
    planIcon: { color: theme.primary },
    commentText: { color: theme.textMuted, fontSize: typography.size.xs, lineHeight: 18 },
    commentActions: { alignItems: "center", flexDirection: "row", gap: spacing[4], marginTop: spacing[1] },
    commentAction: { alignItems: "center", flexDirection: "row", gap: 4 },
    actionText: { color: theme.textSubtle, fontSize: 10, fontWeight: typography.weight.bold },
    likedAction: { color: theme.primary },
    repliesToggle: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, marginLeft: spacing[4] },
    toggleText: { color: theme.textSubtle, fontSize: 10, fontWeight: typography.weight.bold },
  });

export default QuestionCommentsPanel;
