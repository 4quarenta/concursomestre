import React from "react";
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppBottomNavigation } from "@/components/navigation/AppBottomNavigation";
import { MotionPressable } from "@/components/ui/Primitives";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { blogService, type MobileBlogArticle } from "@/services/blog/blogService";
import { getAssetUrl } from "@/api/client";
import { borders, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(" de ", " ");
};

const getArticleMeta = (article: MobileBlogArticle): string => {
  const date = formatDate(article.publishedAt);
  const readingTime = article.readingMinutes > 0
    ? `${article.readingMinutes} min de leitura`
    : "";
  return [date, readingTime].filter(Boolean).join(" · ");
};

function ArticleImage({
  source,
  alt,
  style,
}: {
  source?: string | null;
  alt?: string | null;
  style: StyleProp<ImageStyle>;
}) {
  const theme = useAppTheme();
  const uri = getAssetUrl(source);
  const [failedSource, setFailedSource] = React.useState<string | null>(null);

  if (!uri || failedSource === uri) {
    return (
      <View
        style={[
          style,
          {
            alignItems: "center",
            backgroundColor: theme.primarySubtle,
            justifyContent: "center",
            overflow: "hidden",
          },
        ]}
      >
        <Ionicons name="newspaper-outline" size={28} color={theme.primary} />
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={alt || "Imagem da notícia"}
      resizeMode="cover"
      source={{ uri }}
      style={style}
      onError={() => setFailedSource(uri)}
    />
  );
}

export default function BlogScreen() {
  const theme = useAppTheme();
  const stylesForTheme = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = React.useState<MobileBlogArticle[]>([]);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("Todos");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadPosts = React.useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const page = await blogService.list();
      setPosts(page.items || []);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as notícias.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const categories = React.useMemo(
    () => [
      "Todos",
      ...Array.from(
        new Set(
          posts
            .map((post) => post.taxonomy?.category?.label || "")
            .filter(Boolean),
        ),
      ),
    ],
    [posts],
  );

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return posts.filter((post) => {
      const postCategory = post.taxonomy?.category?.label || "";
      const matchesCategory = category === "Todos" || postCategory === category;
      const matchesQuery = !normalizedQuery ||
        `${post.title} ${post.excerpt} ${postCategory}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, posts, query]);

  const featuredIndex = filtered.findIndex((post) => post.featured);
  const selectedFeaturedIndex = featuredIndex >= 0 ? featuredIndex : filtered.length > 0 ? 0 : -1;
  const featured = selectedFeaturedIndex >= 0 ? filtered[selectedFeaturedIndex] : undefined;
  const rest = selectedFeaturedIndex >= 0
    ? filtered.filter((_post, index) => index !== selectedFeaturedIndex)
    : [];

  const openArticle = (article: MobileBlogArticle) => {
    router.push(`/noticias/${article.slug}` as never);
  };

  const navigateTab = (route: "inicio" | "questoes" | "simulados" | "desempenho" | "perfil") => {
    router.push(`/${route}` as never);
  };

  return (
    <View style={[stylesForTheme.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Notícias" subtitle="Editais, dicas e novidades dos concursos" />
      <ScrollView
        contentContainerStyle={stylesForTheme.content}
        refreshControl={(
          <RefreshControl
            colors={[theme.primary]}
            onRefresh={() => void loadPosts(true)}
            refreshing={refreshing}
            tintColor={theme.primary}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={[stylesForTheme.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            accessibilityLabel="Buscar notícias"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar notícias"
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            style={[stylesForTheme.searchInput, { color: theme.text }]}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {categories.length > 1 ? (
          <ScrollView
            horizontal
            contentContainerStyle={stylesForTheme.filters}
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item)}
                  style={[
                    stylesForTheme.filter,
                    {
                      backgroundColor: selected ? theme.primary : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? theme.onPrimary : theme.textMuted,
                      fontSize: typography.size.sm,
                      fontWeight: selected ? typography.weight.semibold : typography.weight.medium,
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <View style={stylesForTheme.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[stylesForTheme.empty, { color: theme.textMuted }]}>Carregando notícias...</Text>
          </View>
        ) : error ? (
          <View style={[stylesForTheme.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[stylesForTheme.stateIcon, { backgroundColor: theme.dangerSubtle }]}>
              <Ionicons name="cloud-offline-outline" size={24} color={theme.danger} />
            </View>
            <Text style={[stylesForTheme.stateTitle, { color: theme.text }]}>Não foi possível carregar</Text>
            <Text style={[stylesForTheme.empty, { color: theme.textMuted }]}>{error}</Text>
            <MotionPressable
              accessibilityRole="button"
              onPress={() => void loadPosts()}
              style={[stylesForTheme.retryButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[stylesForTheme.retryLabel, { color: theme.onPrimary }]}>Tentar novamente</Text>
            </MotionPressable>
          </View>
        ) : featured ? (
          <>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir notícia: ${featured.title}`}
              onPress={() => openArticle(featured)}
              style={[stylesForTheme.featured, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <ArticleImage
                source={featured.coverImageUrl}
                alt={featured.coverImageAlt || featured.title}
                style={stylesForTheme.featuredImage}
              />
              <View style={stylesForTheme.featuredBody}>
                <Text style={[stylesForTheme.categoryBadge, { backgroundColor: theme.primarySubtle, color: theme.primary }]}>
                  {(featured.taxonomy?.category?.label || "Notícias").toLocaleUpperCase("pt-BR")}
                </Text>
                <Text numberOfLines={3} style={[stylesForTheme.featuredTitle, { color: theme.text }]}>
                  {featured.title}
                </Text>
                {featured.excerpt ? (
                  <Text numberOfLines={3} style={[stylesForTheme.excerpt, { color: theme.textMuted }]}>
                    {featured.excerpt}
                  </Text>
                ) : null}
                <Text style={[stylesForTheme.meta, { color: theme.textMuted }]}>{getArticleMeta(featured)}</Text>
              </View>
            </MotionPressable>

            {rest.length > 0 ? (
              <View style={stylesForTheme.moreSection}>
                <Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Mais notícias</Text>
                <View style={stylesForTheme.list}>
                  {rest.map((post) => (
                    <MotionPressable
                      key={post.slug}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir notícia: ${post.title}`}
                      onPress={() => openArticle(post)}
                      style={[stylesForTheme.post, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <ArticleImage
                        source={post.coverImageUrl}
                        alt={post.coverImageAlt || post.title}
                        style={stylesForTheme.postImage}
                      />
                      <View style={stylesForTheme.postCopy}>
                        <Text numberOfLines={1} style={[stylesForTheme.category, { color: theme.primary }]}>
                          {(post.taxonomy?.category?.label || "Notícias").toLocaleUpperCase("pt-BR")}
                        </Text>
                        <Text numberOfLines={2} style={[stylesForTheme.postTitle, { color: theme.text }]}>
                          {post.title}
                        </Text>
                        <Text numberOfLines={1} style={[stylesForTheme.meta, { color: theme.textMuted }]}>
                          {getArticleMeta(post)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                    </MotionPressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[stylesForTheme.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[stylesForTheme.stateIcon, { backgroundColor: theme.primarySubtle }]}>
              <Ionicons name="newspaper-outline" size={24} color={theme.primary} />
            </View>
            <Text style={[stylesForTheme.stateTitle, { color: theme.text }]}>
              {posts.length === 0 ? "Nenhuma notícia publicada" : "Nenhuma notícia encontrada"}
            </Text>
            <Text style={[stylesForTheme.empty, { color: theme.textMuted }]}>
              {posts.length === 0
                ? "As notícias publicadas na plataforma aparecerão aqui."
                : "Ajuste a busca ou escolha outra categoria."}
            </Text>
          </View>
        )}
      </ScrollView>
      <AppBottomNavigation
        activeRoute={null}
        bottomInset={insets.bottom}
        onNavigate={navigateTab}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[5] },
  search: {
    alignItems: "center",
    borderRadius: radius.field,
    borderWidth: borders.subtle,
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: typography.size.md },
  filters: { gap: spacing[2], paddingVertical: spacing[1] },
  filter: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: borders.subtle,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  featured: { borderRadius: radius.card, borderWidth: borders.subtle, overflow: "hidden" },
  featuredImage: { height: 196, width: "100%" },
  featuredBody: { gap: spacing[2], padding: spacing[4] },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    overflow: "hidden",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  featuredTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, lineHeight: 28 },
  excerpt: { fontSize: typography.size.md, lineHeight: 23 },
  meta: { fontSize: typography.size.xs, lineHeight: 18 },
  moreSection: { gap: spacing[3], marginTop: spacing[1] },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  list: { gap: spacing[2] },
  post: {
    alignItems: "center",
    borderRadius: radius.card,
    borderWidth: borders.subtle,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 112,
    overflow: "hidden",
    padding: spacing[2],
  },
  postImage: { borderRadius: radius.sm, height: 88, width: 112 },
  postCopy: { flex: 1, gap: spacing[1] },
  category: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 0.3 },
  postTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, lineHeight: 20 },
  loading: { alignItems: "center", gap: spacing[3], paddingVertical: spacing[12] },
  stateCard: {
    alignItems: "center",
    borderRadius: radius.card,
    borderWidth: borders.subtle,
    gap: spacing[3],
    padding: spacing[6],
  },
  stateIcon: { alignItems: "center", borderRadius: radius.md, height: 52, justifyContent: "center", width: 52 },
  stateTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: "center" },
  empty: { fontSize: typography.size.sm, lineHeight: 21, textAlign: "center" },
  retryButton: { alignItems: "center", borderRadius: radius.button, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[4] },
  retryLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
