/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import changelogService from "@/services/changelog/changelogService";
import { readApiErrorMessage } from "@/services/api/response";
import type { ChangelogCategory, ChangelogVersion } from "@/types/changelog";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const iconForCategory = (icon: string): keyof typeof Ionicons.glyphMap => {
  const normalized = icon.toLowerCase();
  if (normalized.includes("question") || normalized.includes("book")) return "book-outline";
  if (normalized.includes("simulation") || normalized.includes("timer")) return "timer-outline";
  if (normalized.includes("profile") || normalized.includes("user")) return "person-outline";
  if (normalized.includes("notification") || normalized.includes("bell")) return "notifications-outline";
  if (normalized.includes("performance") || normalized.includes("chart")) return "bar-chart-outline";
  return "sparkles-outline";
};

const formatReleaseDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const CategoryBlock: React.FC<{ category: ChangelogCategory; styles: ReturnType<typeof createStyles>; theme: ResolvedAppTheme }> = ({ category, styles, theme }) => (
  <View style={styles.category}>
    <View style={styles.categoryHeader}>
      <View style={styles.categoryIcon}>
        <Ionicons name={iconForCategory(category.icon)} size={16} color={theme.primary} />
      </View>
      <Text style={styles.categoryTitle}>{category.title}</Text>
    </View>
    <View style={styles.itemList}>
      {(category.items || []).map((item) => (
        <View key={item} style={styles.itemRow}>
          <Ionicons name="checkmark-circle" size={16} color={theme.success} />
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  </View>
);

export function ChangelogScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [versions, setVersions] = React.useState<ChangelogVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const loadVersions = React.useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage("");
    try {
      const result = await changelogService.listVersions();
      setVersions(result);
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error, "Não foi possível carregar as novidades agora."));
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  return (
    <View style={styles.screen}>
      <ContentHeader
        title="Novidades"
        subtitle="Veja o que mudou na plataforma"
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing[12] + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadVersions(true)}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introEyebrow}>EVOLUÇÃO DA PLATAFORMA</Text>
            <Text style={styles.introTitle}>Novidades</Text>
            <Text style={styles.introDescription}>
              Acompanhe as melhorias e veja como cada atualização pode ajudar nos seus estudos.
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="alert-circle-outline" size={36} color={theme.danger} />
            </View>
            <Text style={styles.stateTitle}>Novidades indisponíveis</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <Pressable onPress={() => void loadVersions(true)} style={styles.retryButton}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : versions.length ? (
          versions.map((version, index) => (
            <View key={version.id} style={styles.versionCard}>
              <View style={styles.versionMeta}>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
                  <Text style={styles.dateText}>{formatReleaseDate(version.release_date)}</Text>
                </View>
                {index === 0 ? <Text style={styles.latestBadge}>MAIS RECENTE</Text> : null}
                <Text style={styles.versionLabel}>v{version.version}</Text>
              </View>
              <View style={styles.versionBody}>
                <Text style={styles.versionTitle}>{version.title}</Text>
                <Text style={styles.versionDescription}>{version.description}</Text>
                <View style={styles.categories}>
                  {(version.content_json || []).map((category) => (
                    <CategoryBlock key={`${version.id}-${category.title}`} category={category} styles={styles} theme={theme} />
                  ))}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={styles.stateTitle}>Nenhuma novidade publicada</Text>
            <Text style={styles.stateText}>As próximas atualizações aparecerão aqui.</Text>
            <Pressable onPress={() => void loadVersions(true)} style={styles.retryButton}>
              <Text style={styles.retryText}>Atualizar</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[4], padding: spacing[5] },
  intro: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  introIcon: { alignItems: "center", backgroundColor: theme.surface, borderRadius: radius.md, height: 42, justifyContent: "center", width: 42 },
  introCopy: { flex: 1, gap: spacing[1] },
  introEyebrow: { color: theme.primary, fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1 },
  introTitle: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  introDescription: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
  versionCard: { backgroundColor: theme.surface, borderRadius: radius.lg, elevation: 1, gap: spacing[4], padding: spacing[4], shadowColor: theme.text, shadowOpacity: 0.05, shadowRadius: 5 },
  versionMeta: { gap: spacing[2] },
  dateRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  dateText: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  latestBadge: { alignSelf: "flex-start", backgroundColor: theme.primarySubtle, borderRadius: radius.sm, color: theme.primary, fontSize: 9, fontWeight: typography.weight.bold, letterSpacing: 0.8, overflow: "hidden", paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  versionLabel: { color: theme.textSubtle, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  versionBody: { gap: spacing[3] },
  versionTitle: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  versionDescription: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 21 },
  categories: { gap: spacing[4] },
  category: { gap: spacing[2] },
  categoryHeader: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  categoryIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.sm, height: 28, justifyContent: "center", width: 28 },
  categoryTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  itemList: { gap: spacing[2], paddingLeft: spacing[1] },
  itemRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing[2] },
  itemText: { color: theme.textMuted, flex: 1, fontSize: typography.size.sm, lineHeight: 20 },
  stateCard: { alignItems: "center", borderColor: theme.border, borderRadius: radius.lg, borderStyle: "dashed", borderWidth: 1, gap: spacing[3], justifyContent: "center", minHeight: 220, padding: spacing[6] },
  emptyIcon: { alignItems: "center", backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, justifyContent: "center", padding: spacing[4] },
  stateTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.bold, textAlign: "center" },
  stateText: { color: theme.textMuted, fontSize: typography.size.sm, textAlign: "center" },
  retryButton: { backgroundColor: theme.primary, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  retryText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});

export default ChangelogScreen;
