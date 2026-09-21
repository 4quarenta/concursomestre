import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AdPlaceholder } from "@/features/content/components/AdPlaceholder";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { blogService, type MobileBlogArticle } from "@/services/blog/blogService";
import { spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR");
};

export default function BlogScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [posts, setPosts] = React.useState<MobileBlogArticle[]>([]);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("Todos");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void blogService
      .list()
      .then((page) => {
        if (active) setPosts(page.items || []);
      })
      .catch((loadError: any) => {
        if (active) setError(loadError?.message || "Não foi possível carregar as notícias.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const postCategory = post.taxonomy?.category?.label || "";
      const matchesCategory = category === "Todos" || postCategory === category;
      const matchesQuery = !normalizedQuery ||
        `${post.title} ${post.excerpt} ${postCategory}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, posts, query]);
  const [featured, ...rest] = filtered;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Notícias" subtitle="Editais, dicas e novidades dos concursos" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar notícias"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {categories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[styles.filter, { backgroundColor: category === item ? theme.primary : theme.surfaceSubtle }]}
              >
                <Text style={{ color: category === item ? theme.onPrimary : theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.medium }}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.empty, { color: theme.textMuted }]}>Carregando notícias...</Text>
          </View>
        ) : error ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.danger} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Não foi possível carregar</Text>
            <Text style={[styles.empty, { color: theme.textMuted }]}>{error}</Text>
          </View>
        ) : featured ? (
          <>
            <Pressable
              onPress={() => router.push(`/noticias/${featured.slug}`)}
              style={[styles.featured, { backgroundColor: theme.surface }]}
            >
              <View style={[styles.featuredTop, { backgroundColor: theme.primary }]}>
                <Text style={[styles.badge, { color: theme.onPrimary, backgroundColor: "rgba(255,255,255,0.18)" }]}>
                  {(featured.taxonomy?.category?.label || "Notícias").toUpperCase()}
                </Text>
                <Text style={[styles.featuredTitle, { color: theme.onPrimary }]}>{featured.title}</Text>
              </View>
              <View style={styles.featuredBody}>
                <Text style={[styles.excerpt, { color: theme.textMuted }]}>{featured.excerpt}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {formatDate(featured.publishedAt)} · {featured.readingMinutes || "--"} min
                </Text>
              </View>
            </Pressable>
            <AdPlaceholder />
            <View style={styles.list}>
              {rest.map((post) => (
                <Pressable
                  key={post.slug}
                  onPress={() => router.push(`/noticias/${post.slug}`)}
                  style={[styles.post, { backgroundColor: theme.surface }]}
                >
                  <View style={styles.postCopy}>
                    <Text style={[styles.category, { color: theme.primary }]}>
                      {(post.taxonomy?.category?.label || "Notícias").toUpperCase()}
                    </Text>
                    <Text style={[styles.postTitle, { color: theme.text }]}>{post.title}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {formatDate(post.publishedAt)} · {post.readingMinutes || "--"} min
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="newspaper-outline" size={36} color={theme.textSubtle} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhuma notícia publicada</Text>
            <Text style={[styles.empty, { color: theme.textMuted }]}>Novos conteúdos aparecerão aqui quando forem publicados.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[12] },
  search: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[3] },
  searchInput: { flex: 1, minHeight: 46, fontSize: typography.size.sm },
  filters: { gap: spacing[2] },
  filter: { borderRadius: 999, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  featured: { borderRadius: 16, overflow: "hidden" },
  featuredTop: { gap: spacing[3], padding: spacing[5] },
  badge: { alignSelf: "flex-start", borderRadius: 999, fontSize: 10, fontWeight: typography.weight.bold, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  featuredTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, lineHeight: 26 },
  featuredBody: { gap: spacing[2], padding: spacing[5] },
  excerpt: { fontSize: typography.size.md, lineHeight: 23 },
  meta: { fontSize: typography.size.xs },
  list: { gap: spacing[3] },
  post: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  postCopy: { flex: 1, gap: spacing[1] },
  category: { fontSize: 10, fontWeight: typography.weight.bold },
  postTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, lineHeight: 21 },
  loading: { alignItems: "center", gap: spacing[3], paddingVertical: spacing[12] },
  emptyCard: { alignItems: "center", borderRadius: 16, borderWidth: 1, gap: spacing[2], padding: spacing[6] },
  emptyTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: "center" },
  empty: { fontSize: typography.size.sm, textAlign: "center" },
});
