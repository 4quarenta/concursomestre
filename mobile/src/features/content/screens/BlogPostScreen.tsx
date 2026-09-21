import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { QuestionCommentsPanel } from "@/components/questions/QuestionCommentsPanel";
import { blogService, type MobileBlogArticle } from "@/services/blog/blogService";
import { commentsService } from "@/services/comments/commentsService";
import { useAuth } from "@/providers/AuthProvider";
import { spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import type { QuestionComment } from "@/types/comments";

const stripHtml = (value?: string | null): string =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const routeValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR");
};

export default function BlogPostScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();
  const { slug: rawSlug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = routeValue(rawSlug);
  const [article, setArticle] = React.useState<MobileBlogArticle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<QuestionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [commentSubmitting, setCommentSubmitting] = React.useState(false);
  const [likePending, setLikePending] = React.useState(false);

  const loadComments = React.useCallback(async () => {
    if (!article?.allowComments) return;
    setCommentsLoading(true);
    try {
      const nextComments = await commentsService.getComments(
        String(article.id),
        user?.id,
        "blog_article",
      );
      setComments(nextComments);
    } catch (loadError: any) {
      Alert.alert(
        "Comentários",
        loadError?.message || "Não foi possível carregar os comentários.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }, [article?.allowComments, article?.id, user?.id]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void blogService
      .detail(slug)
      .then((nextArticle) => {
        if (active) setArticle(nextArticle);
      })
      .catch((loadError: any) => {
        if (active) {
          setArticle(null);
          setError(loadError?.message || "Não foi possível carregar a notícia.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  React.useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const requireUser = () => {
    if (user) return true;
    Alert.alert("Entre na sua conta", "Faça login para participar da comunidade.");
    return false;
  };

  const toggleLike = async () => {
    if (!article || likePending || !requireUser()) return;
    setLikePending(true);
    try {
      const result = await blogService.toggleLike(article.id);
      setArticle((current) =>
        current
          ? {
              ...current,
              engagement: {
                ...current.engagement,
                isLiked: result.liked,
                likesCount: result.likesCount,
              },
            }
          : current,
      );
    } catch (likeError: any) {
      Alert.alert(
        "Curtir notícia",
        likeError?.message || "Não foi possível atualizar a curtida.",
      );
    } finally {
      setLikePending(false);
    }
  };

  const shareArticle = async () => {
    if (!article) return;
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.excerpt}\n\nhttps://concursomestre.com/blog/${article.slug}`,
      });
    } catch (shareError: any) {
      Alert.alert(
        "Compartilhar notícia",
        shareError?.message || "Não foi possível compartilhar a notícia.",
      );
    }
  };

  const submitComment = async (content: string, parentId?: string) => {
    if (!article || !user || !requireUser()) return;
    const text = content.trim();
    if (!text) return;
    setCommentSubmitting(true);
    try {
      await commentsService.addComment({
        questionId: String(article.id),
        content: text,
        parentId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.photoUrl,
        userPlan: user.plan,
        targetType: "blog_article",
      });
      setCommentDraft("");
      await loadComments();
    } catch (commentError: any) {
      Alert.alert(
        "Comentários",
        commentError?.message || "Não foi possível publicar o comentário.",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const likeComment = async (commentId: string) => {
    if (!user || !requireUser()) return;
    try {
      await commentsService.likeComment(commentId, user.id);
      await loadComments();
    } catch (likeError: any) {
      Alert.alert(
        "Comentários",
        likeError?.message || "Não foi possível curtir o comentário.",
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.muted, { color: theme.textMuted }]}>Carregando notícia...</Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={42} color={theme.danger} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Notícia indisponível</Text>
        <Text style={[styles.muted, { color: theme.textMuted }]}>
          {error || "Não foi possível encontrar esta notícia."}
        </Text>
      </View>
    );
  }

  const bodyText = stripHtml(article.bodyText || article.bodyHtml);
  const paragraphs = bodyText
    ? bodyText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
    : [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Notícia"
        subtitle={`${formatDate(article.publishedAt)} · ${article.readingMinutes || "--"} min`}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.category, { color: theme.primary }]}>
          {(article.taxonomy?.category?.label || "Notícias").toUpperCase()}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>{article.title}</Text>
        <Text style={[styles.byline, { color: theme.textMuted }]}>
          Por {article.author?.name || "Redação"} · {formatDate(article.publishedAt)}
        </Text>
        <Text style={[styles.excerpt, { color: theme.textMuted }]}>{article.excerpt}</Text>

        <View style={styles.engagementRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={article.engagement.isLiked ? "Descurtir notícia" : "Curtir notícia"}
            disabled={likePending}
            onPress={() => void toggleLike()}
            style={[
              styles.engagementButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              article.engagement.isLiked && {
                backgroundColor: theme.dangerSubtle,
                borderColor: theme.dangerBorder,
              },
            ]}
          >
            {likePending ? (
              <ActivityIndicator size="small" color={theme.danger} />
            ) : (
              <Ionicons
                name={article.engagement.isLiked ? "heart" : "heart-outline"}
                size={19}
                color={article.engagement.isLiked ? theme.danger : theme.textMuted}
              />
            )}
            <Text
              style={[
                styles.engagementText,
                { color: article.engagement.isLiked ? theme.danger : theme.text },
              ]}
            >
              {article.engagement.likesCount}
            </Text>
          </Pressable>
          <View style={[styles.engagementStat, { backgroundColor: theme.surfaceSubtle }]}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textMuted} />
            <Text style={[styles.engagementText, { color: theme.textMuted }]}>
              {article.engagement.commentsCount}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartilhar notícia"
            onPress={() => void shareArticle()}
            style={[styles.shareButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="share-social-outline" size={18} color={theme.onPrimary} />
            <Text style={[styles.shareText, { color: theme.onPrimary }]}>Compartilhar</Text>
          </Pressable>
        </View>

        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => (
            <Text key={`${article.id}-${index}`} style={[styles.paragraph, { color: theme.text }]}>
              {paragraph}
            </Text>
          ))
        ) : (
          <Text style={[styles.paragraph, { color: theme.text }]}>
            O conteúdo completo desta notícia está disponível na plataforma.
          </Text>
        )}

        {article.allowComments ? (
          <QuestionCommentsPanel
            comments={comments}
            loading={commentsLoading}
            draft={commentDraft}
            submitting={commentSubmitting}
            onChangeDraft={setCommentDraft}
            onSubmitComment={submitComment}
            onLikeComment={likeComment}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: {
      gap: spacing[5],
      padding: spacing[5],
      paddingBottom: spacing[12],
    },
    center: {
      alignItems: "center",
      flex: 1,
      gap: spacing[3],
      justifyContent: "center",
      padding: spacing[6],
    },
    muted: { fontSize: typography.size.sm, textAlign: "center" },
    errorTitle: {
      fontSize: typography.size.xl,
      fontWeight: typography.weight.extrabold,
    },
    category: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    title: {
      fontSize: typography.size["2xl"],
      fontWeight: typography.weight.bold,
      lineHeight: 31,
    },
    byline: { fontSize: typography.size.xs },
    excerpt: { fontSize: typography.size.md, lineHeight: 24 },
    paragraph: { fontSize: typography.size.md, lineHeight: 27 },
    engagementRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[2],
    },
    engagementButton: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[1],
      minHeight: 44,
      paddingHorizontal: spacing[3],
    },
    engagementStat: {
      alignItems: "center",
      borderRadius: 12,
      flexDirection: "row",
      gap: spacing[1],
      minHeight: 44,
      paddingHorizontal: spacing[3],
    },
    engagementText: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    shareButton: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      flexDirection: "row",
      gap: spacing[1],
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing[2],
    },
    shareText: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
  });
