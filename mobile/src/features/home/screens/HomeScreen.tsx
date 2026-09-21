import React from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useActiveSimulationQuery } from "@/features/simulations/api/useActiveSimulationQuery";
import { useAuth } from "@/providers/AuthProvider";
import { statisticsService } from "@/services/statistics/statisticsService";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { UserStatistics } from "@/types/statistics";
import type { MobileFeatureKey } from "@/types/system";

const EMPTY_STATS: UserStatistics = {
  userId: "",
  totalQuestionsAnswered: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  accuracyRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  questionStudyTime: 0,
  readingStudyTime: 0,
  totalStudyTime: 0,
  lastActivity: "",
  subjectBreakdown: [],
  timeline: [],
};

const quickActions: Array<{
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  feature?: MobileFeatureKey;
}> = [
  {
    label: "Flashcards",
    description: "Memorize com revisão espaçada",
    icon: "layers-outline",
    route: "/flashcards",
    feature: "flashcardsEnabled",
  },
  {
    label: "Notícias",
    description: "Editais e dicas de estudo",
    icon: "newspaper-outline",
    route: "/noticias",
  },
  {
    label: "Novidades",
    description: "Veja o que mudou na plataforma",
    icon: "sparkles-outline",
    route: "/novidades",
  },
  {
    label: "Lei comentada",
    description: "Legislação artigo por artigo",
    icon: "scale-outline",
    route: "/lei-comentada",
    feature: "annotatedLawsEnabled",
  },
  {
    label: "Trilhas de estudo",
    description: "Aprenda passo a passo",
    icon: "map-outline",
    route: "/trilhas",
    feature: "studyScheduleEnabled",
  },
  {
    label: "Revisão de erros",
    description: "Reforce pontos fracos",
    icon: "trending-up-outline",
    route: "/revisao",
    feature: "practiceEnabled",
  },
  {
    label: "Ranking",
    description: "Compita com outros",
    icon: "trophy-outline",
    route: "/ranking",
    feature: "rankingsEnabled",
  },
];

const formatRecentResult = (
  questions: number,
  correct: number,
  wrong: number,
) => {
  const total = questions || correct + wrong;
  return total ? `${correct}/${total}` : "--";
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
};

const drawerItems = [
  { label: "Início", icon: "home-outline" as const, route: "/inicio" },
  {
    label: "Questões",
    icon: "book-outline" as const,
    route: "/questoes",
  },
  {
    label: "Simulados",
    icon: "document-text-outline" as const,
    route: "/simulados",
  },
  {
    label: "Desempenho",
    icon: "bar-chart-outline" as const,
    route: "/desempenho",
  },
  { label: "Perfil", icon: "person-outline" as const, route: "/perfil" },
  {
    label: "Notificações",
    icon: "notifications-outline" as const,
    route: "/notificacoes",
  },
  { label: "Ajuda", icon: "help-buoy-outline" as const, route: "/ajuda" },
];

const DRAWER_WIDTH = 304;

export const HomeScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, systemSettings } = useAuth();
  const activeSimulationQuery = useActiveSimulationQuery();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [greeting, setGreeting] = React.useState(getGreeting);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const drawerProgress = React.useRef(new Animated.Value(0)).current;

  const openDrawer = React.useCallback(() => {
    setDrawerOpen(true);
    Animated.spring(drawerProgress, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [drawerProgress]);

  const closeDrawer = React.useCallback(() => {
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  }, [drawerProgress]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isHorizontal =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          if (!isHorizontal) return false;
          if (drawerOpen) return Math.abs(gestureState.dx) > 8;
          return gestureState.x0 < 28 && gestureState.dx > 8;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextProgress = drawerOpen
            ? Math.max(0, Math.min(1, 1 + gestureState.dx / DRAWER_WIDTH))
            : Math.max(0, Math.min(1, gestureState.dx / DRAWER_WIDTH));
          drawerProgress.setValue(nextProgress);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (drawerOpen) {
            if (gestureState.dx < -DRAWER_WIDTH / 3) closeDrawer();
            else openDrawer();
          } else if (gestureState.dx > DRAWER_WIDTH / 3) {
            openDrawer();
          } else {
            closeDrawer();
          }
        },
        onPanResponderTerminate: () => {
          if (drawerOpen) openDrawer();
          else closeDrawer();
        },
      }),
    [closeDrawer, drawerOpen, drawerProgress, openDrawer],
  );

  const loadStats = React.useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setStats(EMPTY_STATS);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setStats(await statisticsService.getUserStatistics(user.id));
      } catch (loadError: any) {
        // A Home continua utilizável mesmo quando o resumo estatístico está
        // temporariamente indisponível. Os cartões exibem os valores seguros
        // de EMPTY_STATS e o próximo pull-to-refresh tenta sincronizar de novo.
        void loadError;
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user?.id],
  );

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);
  React.useEffect(() => {
    const timer = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (loading)
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );

  const firstSubject = stats.subjectBreakdown[0]?.subject || "Prática geral";
  const recentTimeline = stats.timeline.slice(-3).reverse();
  const hasActiveSimulation = Boolean(
    activeSimulationQuery.data?.questions?.length,
  );

  const displayName = user?.name || "Aluno ConcursoMestre";
  const planName =
    user?.subscription?.plan?.name ||
    user?.billing?.plan ||
    user?.plan ||
    "Gratuito";
  const visibleQuickActions = quickActions.filter(
    (action) => !action.feature || systemSettings.features[action.feature],
  );

  return (
    <View style={styles.screen} {...panResponder.panHandlers}>
      <StatusBar style="light" />
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.brand.lavender, paddingTop: spacing[5] },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir menu lateral"
              style={({ pressed }) => [
                styles.menuButton,
                pressed && styles.pressed,
              ]}
              onPress={openDrawer}
            >
              <Ionicons name="menu" size={24} color={theme.onPrimary} />
            </Pressable>
            <View style={styles.identityCopy}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                numberOfLines={1}
                style={styles.heroGreeting}
              >
                {greeting} 👋
              </Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.heroName}
              >
                {displayName}
              </Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notificações"
              style={styles.heroIconButton}
              onPress={() => router.push("/notificacoes")}
            >
              <Ionicons
                name="notifications-outline"
                size={18}
                color={theme.onPrimary}
              />
              <View style={styles.notificationDot} />
            </Pressable>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color="#FBBF24" />
              <Text style={styles.streakText}>{stats.currentStreak} dias</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        removeClippedSubviews={false}
        style={styles.bodyScroll}
        overScrollMode="never"
        contentContainerStyle={[
          styles.body,
          { paddingBottom: spacing[8] + 64 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadStats(true)}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.continueSection}>
          <View
            style={[
              styles.continueBlueBox,
              { backgroundColor: palette.brand.lavender },
            ]}
          />
          <View style={styles.continueCard}>
            <View style={styles.continueHeader}>
              <View style={styles.continueCopy}>
                <Text style={styles.cardTitle}>Continuar estudando</Text>
                <Text style={styles.cardSubtitle}>{firstSubject}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.continueButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  router.push(hasActiveSimulation ? "/simulados" : "/questoes")
                }
              >
                <Ionicons
                  name="flash-outline"
                  size={16}
                  color={theme.onPrimary}
                />
                <Text style={styles.continueButtonText}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="book-outline"
            label="Questões"
            value={String(stats.totalQuestionsAnswered)}
            color={theme.primary}
            styles={styles}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Acertos"
            value={`${Math.round(stats.accuracyRate)}%`}
            color={theme.success}
            styles={styles}
          />
          <StatCard
            icon="close-circle-outline"
            label="Erros"
            value={String(stats.wrongAnswers)}
            color={theme.danger}
            styles={styles}
          />
          <StatCard
            icon="time-outline"
            label="Tempo médio"
            value="--"
            color={theme.warning}
            styles={styles}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acesso rápido</Text>
          {visibleQuickActions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.quickAction,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push(action.route as never)}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={action.icon} size={20} color={theme.primary} />
              </View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>{action.label}</Text>
                <Text style={styles.quickDescription}>
                  {action.description}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textMuted}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.adSlot}>
          <Text style={styles.adLabel}>PUBLICIDADE</Text>
          <Text style={styles.adText}>Espaço de anúncio</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atividade recente</Text>
          <View style={styles.activityCard}>
            {recentTimeline.length ? (
              recentTimeline.map((item, index) => (
                <View
                  key={`${item.label}-${index}`}
                  style={[
                    styles.activityRow,
                    index > 0 && styles.activityDivider,
                  ]}
                >
                  <View>
                    <Text style={styles.activityTitle}>{item.label}</Text>
                    <Text style={styles.activityTime}>atividade recente</Text>
                  </View>
                  <Text style={styles.activityResult}>
                    {formatRecentResult(
                      item.questions,
                      item.correct,
                      item.wrong,
                    )}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Text style={styles.cardSubtitle}>
                  Ainda não há atividades sincronizadas.
                </Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.premiumCard,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/planos")}
        >
          <View style={styles.premiumIcon}>
            <Ionicons name="trophy-outline" size={20} color={theme.onPrimary} />
          </View>
          <View style={styles.quickCopy}>
            <Text style={styles.premiumTitle}>Desbloqueie tudo</Text>
            <Text style={styles.premiumDescription}>
              Questões ilimitadas, simulados e mais
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.65)"
          />
        </Pressable>

      </ScrollView>

      {drawerOpen ? (
        <View style={styles.drawerLayer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.drawerBackdrop,
              {
                opacity: drawerProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.48],
                }),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar menu lateral"
              style={StyleSheet.absoluteFill}
              onPress={closeDrawer}
            />
          </Animated.View>
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.drawer,
              {
                transform: [
                  {
                    translateX: drawerProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-DRAWER_WIDTH, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.drawerHeader, { paddingTop: spacing[4] }]}>
              <View style={styles.drawerAvatar}>
                <Ionicons name="person" size={22} color={theme.primary} />
              </View>
              <View style={styles.drawerIdentity}>
                <Text numberOfLines={1} style={styles.drawerName}>
                  {displayName}
                </Text>
                <Text style={styles.drawerSubtitle}>Área do aluno</Text>
                <View style={styles.drawerPlanBadge}>
                  <Ionicons name="sparkles-outline" size={12} color={theme.primary} />
                  <Text style={styles.drawerPlanText}>Plano {planName}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar menu lateral"
                onPress={closeDrawer}
                style={styles.drawerClose}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
            <View style={styles.drawerDivider} />
            <ScrollView
              contentContainerStyle={[
                styles.drawerMenu,
                { paddingBottom: spacing[5] },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {drawerItems.map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.drawerItem,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    closeDrawer();
                    router.push(item.route as never);
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={theme.textMuted}
                  />
                  <Text style={styles.drawerItemText}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  color,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    loaderContainer: {
      alignItems: "center",
      backgroundColor: theme.background,
      flex: 1,
      justifyContent: "center",
    },
    bodyScroll: { flex: 1 },
    hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
    heroTopRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      justifyContent: "space-between",
    },
    heroIdentity: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing[2],
      minWidth: 0,
    },
    identityCopy: { flex: 1, minWidth: 0 },
    menuButton: {
      alignItems: "center",
      borderRadius: radius.pill,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    heroGreeting: { color: "rgba(255,255,255,0.82)", fontSize: 11 },
    heroName: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    heroActions: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: spacing[2],
    },
    heroIconButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: radius.pill,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    notificationDot: {
      backgroundColor: "#FBBF24",
      borderColor: palette.brand.lavender,
      borderRadius: radius.pill,
      borderWidth: 2,
      height: 8,
      position: "absolute",
      right: 5,
      top: 5,
      width: 8,
    },
    streakBadge: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    streakText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    drawerLayer: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 10,
    },
    drawerBackdrop: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      backgroundColor: "#000",
    },
    drawer: {
      backgroundColor: theme.surface,
      bottom: 0,
      elevation: 12,
      left: 0,
      position: "absolute",
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 16,
      top: 0,
      width: DRAWER_WIDTH,
    },
    drawerHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[4],
    },
    drawerAvatar: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.pill,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    drawerIdentity: { flex: 1, minWidth: 0 },
    drawerName: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    drawerSubtitle: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      marginTop: 2,
    },
    drawerClose: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    drawerDivider: {
      backgroundColor: theme.border,
      height: 1,
      marginHorizontal: spacing[5],
    },
    drawerMenu: { gap: spacing[1], padding: spacing[4] },
    drawerItem: {
      alignItems: "center",
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: spacing[3],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
    },
    drawerItemText: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    body: { gap: spacing[5], paddingHorizontal: spacing[5] },
    continueSection: { marginHorizontal: -spacing[5] },
    continueBlueBox: { height: 56 },
    continueCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      elevation: 3,
      marginTop: -spacing[6],
      marginHorizontal: spacing[5],
      padding: spacing[5],
      shadowColor: theme.text,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      zIndex: 1,
    },
    continueHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    continueCopy: { flex: 1, gap: 2 },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    cardSubtitle: { color: theme.textMuted, fontSize: typography.size.xs },
    continueButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    continueButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    statsGrid: { flexDirection: "row", gap: spacing[2] },
    statCard: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[3],
      shadowColor: theme.text,
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    statValue: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    statLabel: { color: theme.textMuted, fontSize: 10, textAlign: "center" },
    section: { gap: spacing[2] },
    sectionTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    quickAction: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[4],
      padding: spacing[4],
      shadowColor: theme.text,
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    quickIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.sm,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    quickCopy: { flex: 1, gap: 2 },
    quickTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    quickDescription: { color: theme.textMuted, fontSize: typography.size.xs },
    adSlot: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.md,
      gap: 2,
      padding: spacing[4],
    },
    adLabel: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: typography.weight.bold,
      letterSpacing: 1,
    },
    adText: { color: theme.textMuted, fontSize: typography.size.xs },
    activityCard: {
      backgroundColor: theme.surface,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    activityRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing[4],
    },
    activityDivider: { borderTopColor: theme.border, borderTopWidth: 1 },
    activityTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    activityTime: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      marginTop: 2,
    },
    activityResult: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    emptyActivity: { padding: spacing[4] },
    premiumCard: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[5],
    },
    premiumIcon: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: radius.sm,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    premiumTitle: {
      color: theme.onPrimary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    premiumDescription: {
      color: "rgba(255,255,255,0.8)",
      fontSize: typography.size.xs,
      marginTop: 2,
    },
    pressed: { opacity: 0.76 },
    drawerPlanBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing[1],
      marginTop: spacing[2],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    drawerPlanText: {
      color: theme.primary,
      fontSize: 10,
      fontWeight: typography.weight.bold,
    },
  });

export default HomeScreen;
