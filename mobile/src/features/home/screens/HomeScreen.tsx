import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppButton, AppText, MotionPressable } from "@/components/ui/Primitives";
import { router, useFocusEffect } from "expo-router";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useActiveSimulationQuery } from "@/features/simulations/api/useActiveSimulationQuery";
import { useAuth } from "@/providers/AuthProvider";
import { getAssetUrl } from "@/services/api/client";
import { useHomeDrawerVisibility } from "@/features/home/HomeDrawerVisibilityContext";
import { statisticsService } from "@/services/statistics/statisticsService";
import { touchStudyStreak } from "@/services/statistics/studyStreakService";
import { getLastQuestionFilter, toQuestionListFilters, toQuestionRouteParams } from "@/services/questions/lastQuestionFilterService";
import { questionService } from "@/services/questions/questionService";
import { resolveCanonicalPlanKey } from "@/services/plans/planDetails";
import { darkTheme, palette, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { UserStatistics } from "@/types/statistics";

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
}> = [
  {
    label: "Questões",
    description: "Resolva questões por disciplina",
    icon: "help-circle-outline",
    route: "/questoes",
  },
  {
    label: "Simulados",
    description: "Treine com simulados personalizados",
    icon: "stats-chart-outline",
    route: "/simulados",
  },
  {
    label: "Desempenho",
    description: "Acompanhe sua evolução",
    icon: "trending-up-outline",
    route: "/desempenho",
  },
  {
    label: "Notícias",
    description: "Fique por dentro do mundo dos concursos",
    icon: "newspaper-outline",
    route: "/noticias",
  },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
};

const formatStudyDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}` : `${minutes}min`;
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
    label: "Planos",
    icon: "diamond-outline" as const,
    route: "/planos",
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
const HERO_HEADER_HEIGHT = spacing[3] + spacing[10] + spacing[8];

export const HomeScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user;
  const { setVisible: setDrawerVisible } = useHomeDrawerVisibility();
  const activeSimulationQuery = useActiveSimulationQuery();
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [studyStreak, setStudyStreak] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [greeting, setGreeting] = React.useState(getGreeting);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerAvatarFailed, setDrawerAvatarFailed] = React.useState(false);
  const [continuingStudy, setContinuingStudy] = React.useState(false);
  const drawerProgress = React.useRef(new Animated.Value(0)).current;
  const drawerAvatarUri = user?.photoUrl ? getAssetUrl(user.photoUrl) : "";

  React.useEffect(() => {
    setDrawerAvatarFailed(false);
  }, [drawerAvatarUri]);

  const animateDrawerOpen = React.useCallback(() => {
    drawerProgress.stopAnimation();
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [drawerProgress]);

  const openDrawer = React.useCallback(() => {
    if (drawerOpen) {
      animateDrawerOpen();
      return;
    }

    // Mount the off-screen drawer first. Starting a native animation in the
    // same event as setState can finish before its Animated.View is attached,
    // making it flash directly into the fully-open position.
    setDrawerOpen(true);
    setDrawerVisible(true);
  }, [animateDrawerOpen, drawerOpen, setDrawerVisible]);

  React.useEffect(() => {
    if (!drawerOpen) return undefined;
    const frame = requestAnimationFrame(animateDrawerOpen);
    return () => cancelAnimationFrame(frame);
  }, [animateDrawerOpen, drawerOpen]);

  const closeDrawer = React.useCallback(() => {
    drawerProgress.stopAnimation();
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
      if (finished) setDrawerVisible(false);
    });
  }, [drawerProgress, setDrawerVisible]);

  React.useEffect(() => {
    if (!drawerOpen) return undefined;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeDrawer();
        return true;
      },
    );
    return () => subscription.remove();
  }, [closeDrawer, drawerOpen]);

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
        const [statisticsResult, answerSnapshotResult] = await Promise.allSettled([
          statisticsService.getUserStatistics(user.id),
          statisticsService.getCurrentUserAnswerSnapshot(),
        ]);
        if (statisticsResult.status === 'fulfilled' && answerSnapshotResult.status === 'fulfilled') {
          const nextStats = statisticsResult.value;
          setStats({
            ...nextStats,
            ...answerSnapshotResult.value.summary,
            subjectBreakdown: answerSnapshotResult.value.subjectBreakdown.length > 0
              ? answerSnapshotResult.value.subjectBreakdown
              : nextStats.subjectBreakdown,
          });
        } else if (statisticsResult.status === 'fulfilled') {
          setStats(statisticsResult.value);
        } else if (answerSnapshotResult.status === 'fulfilled') {
          setStats((current) => ({
            ...current,
            ...answerSnapshotResult.value.summary,
            subjectBreakdown: answerSnapshotResult.value.subjectBreakdown.length > 0
              ? answerSnapshotResult.value.subjectBreakdown
              : current.subjectBreakdown,
          }));
        }
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

  useFocusEffect(React.useCallback(() => {
    void loadStats();
    return undefined;
  }, [loadStats]));
  React.useEffect(() => {
    let active = true;
    if (user?.id) {
      void touchStudyStreak(user.id).then((snapshot) => {
        if (active) setStudyStreak(snapshot.current);
      });
    } else {
      setStudyStreak(0);
    }
    return () => { active = false; };
  }, [user?.id]);
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
  const hasActiveSimulation = Boolean(
    activeSimulationQuery.data?.questions?.length,
  );

  const displayName = user?.name || "Visitante";
  const planName =
    user?.subscription?.plan?.name ||
    user?.billing?.plan ||
    user?.plan ||
    "Gratuito";
  const isElitePlan = resolveCanonicalPlanKey(planName) === "Elite";
  const isDarkTheme = theme === darkTheme;
  const eliteAccent = isDarkTheme ? "#EFC766" : "#9A6A0A";
  const eliteBorder = isDarkTheme ? "#80652B" : "#D9B45D";
  const eliteSurface = isDarkTheme ? "#282316" : "#FFFAF0";
  const visibleQuickActions = quickActions;
  const visibleDrawerItems = isVisitor
    ? drawerItems.filter((item) => item.route !== "/notificacoes")
    : drawerItems;

  const continueStudying = async () => {
    if (continuingStudy) return;
    if (hasActiveSimulation) {
      router.push("/simulados");
      return;
    }

    setContinuingStudy(true);
    try {
      const lastFilter = await getLastQuestionFilter();
      if (!lastFilter) {
        router.push("/questoes");
        return;
      }

      const result = await questionService.getQuestionPage({
        ...toQuestionListFilters(lastFilter),
        page: 1,
        limit: 1,
      });
      const firstQuestion = result.rows.find((question) => question.id !== undefined && question.id !== null);
      if (!firstQuestion?.id) {
        Alert.alert(
          "Nenhuma questão encontrada",
          "Os últimos filtros não retornaram questões. Ajuste os filtros para continuar.",
          [{ text: "Abrir filtros", onPress: () => router.push("/questoes") }, { text: "Agora não", style: "cancel" }],
        );
        return;
      }

      router.push({
        pathname: "/questao/[id]",
        params: toQuestionRouteParams(lastFilter, firstQuestion.id),
      });
    } catch (error: any) {
      Alert.alert(
        "Não foi possível continuar",
        error?.message || "Verifique sua conexão e tente novamente.",
        [{ text: "Abrir filtros", onPress: () => router.push("/questoes") }, { text: "Fechar", style: "cancel" }],
      );
    } finally {
      setContinuingStudy(false);
    }
  };

  return (
    <View style={styles.screen} {...panResponder.panHandlers}>
      <ExpoStatusBar style="light" />
      <NativeStatusBar
        barStyle="light-content"
        backgroundColor={palette.brand.navy}
      />
      <View pointerEvents="none" style={styles.heroBackground} />

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
          <View style={styles.continueCard}>
            <View style={styles.continueHeader}>
              <View style={styles.continueCopy}>
                <AppText variant="sectionTitle" style={styles.cardTitle}>Continuar estudando</AppText>
                <AppText variant="body" tone="muted" style={styles.cardSubtitle}>{firstSubject}</AppText>
              </View>
              <AppButton
                label="Continuar"
                leading={<Ionicons name="play" size={16} color={theme.onPrimary} />}
                loading={continuingStudy}
                onPress={() => void continueStudying()}
                style={styles.continueButton}
              />
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
            divider
          />
          <StatCard
            icon="close-circle-outline"
            label="Erros"
            value={String(stats.wrongAnswers)}
            color={theme.danger}
            styles={styles}
            divider
          />
          <StatCard
            icon="time-outline"
            label="Tempo de estudo"
            value={formatStudyDuration(stats.totalStudyTime || 0)}
            color={theme.warning}
            styles={styles}
            divider
          />
        </View>

        <View style={styles.section}>
          <AppText variant="sectionTitle" style={styles.sectionTitle}>Acesso rápido</AppText>
          {visibleQuickActions.map((action) => (
            <MotionPressable
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
                <AppText variant="bodyStrong" style={styles.quickTitle}>{action.label}</AppText>
                <AppText variant="caption" tone="muted" style={styles.quickDescription}>
                  {action.description}
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textMuted}
              />
            </MotionPressable>
          ))}
        </View>

      </ScrollView>

      <View pointerEvents="box-none" style={styles.heroFixedContent}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Abrir menu lateral"
              hitSlop={2}
              style={({ pressed }) => [
                styles.menuButton,
                pressed && styles.pressed,
              ]}
              onPress={openDrawer}
            >
              <Ionicons name="menu" size={24} color={palette.white} />
            </MotionPressable>
            <View style={styles.identityCopy}>
              <Text numberOfLines={1} style={styles.heroGreeting}>
                {greeting},
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.heroName}
              >
                {displayName}
              </Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            {!isVisitor ? (
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Notificações"
                hitSlop={4}
                style={styles.heroIconButton}
                onPress={() => router.push("/notificacoes")}
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={palette.white}
                />
                <View style={styles.notificationDot} />
              </MotionPressable>
            ) : null}
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color={palette.amber[500]} />
              <Text style={styles.streakText}>{studyStreak} dias</Text>
            </View>
          </View>
        </View>
      </View>

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
                {drawerAvatarUri && !drawerAvatarFailed ? (
                  <Image
                    accessibilityLabel="Foto do perfil"
                    onError={() => setDrawerAvatarFailed(true)}
                    source={{ uri: drawerAvatarUri }}
                    style={styles.drawerAvatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={22} color={theme.primary} />
                )}
              </View>
              <View style={styles.drawerIdentity}>
                <Text numberOfLines={1} style={styles.drawerName}>
                  {displayName}
                </Text>
                <Text style={styles.drawerSubtitle}>Área do aluno</Text>
                {!isVisitor ? (
                  <View
                    style={[
                      styles.drawerPlanBadge,
                      isElitePlan && {
                        backgroundColor: eliteSurface,
                        borderColor: eliteBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isElitePlan ? "diamond" : "sparkles-outline"}
                      size={12}
                      color={isElitePlan ? eliteAccent : theme.primary}
                    />
                    <Text
                      style={[
                        styles.drawerPlanText,
                        isElitePlan && { color: eliteAccent },
                      ]}
                    >
                      {isElitePlan ? "ELITE · ACESSO MÁXIMO" : `Plano ${planName}`}
                    </Text>
                  </View>
                ) : null}
              </View>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Fechar menu lateral"
                onPress={closeDrawer}
                style={styles.drawerClose}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </MotionPressable>
            </View>
            <View style={styles.drawerDivider} />
            <ScrollView
              contentContainerStyle={[
                styles.drawerMenu,
                { paddingBottom: spacing[5] },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {visibleDrawerItems.map((item) => (
                <MotionPressable
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
                </MotionPressable>
              ))}
              {isVisitor ? (
                <View style={styles.drawerAuthActions}>
                  <AppButton
                    label="Entrar"
                    onPress={() => {
                      closeDrawer();
                      router.push("/login");
                    }}
                    style={styles.drawerAuthButton}
                  />
                  <AppButton
                    label="Criar conta"
                    variant="secondary"
                    onPress={() => {
                      closeDrawer();
                      router.push("/cadastro");
                    }}
                    style={styles.drawerAuthButton}
                  />
                </View>
              ) : null}
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
  divider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
  divider?: boolean;
}) => (
  <View style={[styles.statCard, divider && styles.statCardDivider]}>
    <Ionicons name={icon} size={20} color={color} />
    <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.statValue}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const createStyles = (theme: ResolvedAppTheme) => {
  const cardShadow = theme === darkTheme ? shadows.cardDark : {};
  const drawerShadow = theme === darkTheme ? shadows.cardDark : {};
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    loaderContainer: {
      alignItems: "center",
      backgroundColor: theme.background,
      flex: 1,
      justifyContent: "center",
    },
    bodyScroll: {
      flex: 1,
      marginTop: HERO_HEADER_HEIGHT - spacing[6],
      zIndex: 1,
    },
    heroBackground: {
      backgroundColor: palette.brand.navy,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
      height: HERO_HEADER_HEIGHT,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    heroFixedContent: {
      height: spacing[10] + spacing[1],
      left: spacing[5],
      overflow: "visible",
      position: "absolute",
      right: spacing[5],
      top: spacing[3],
      zIndex: 3,
    },
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
    heroGreeting: {
      color: palette.brand.onNavyMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    heroName: {
      color: palette.white,
      fontSize: 18,
      fontWeight: typography.weight.bold,
      lineHeight: 23,
    },
    heroActions: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: spacing[2],
    },
    heroIconButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 10,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    notificationDot: {
      backgroundColor: palette.red[300],
      borderColor: palette.brand.navy,
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
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    streakText: {
      color: palette.white,
      fontSize: 11,
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
      left: 0,
      position: "absolute",
      top: 0,
      width: DRAWER_WIDTH,
      ...drawerShadow,
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
      overflow: "hidden",
      width: 44,
    },
    drawerAvatarImage: { height: "100%", width: "100%" },
    drawerIdentity: { flex: 1, minWidth: 0 },
    drawerName: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    drawerSubtitle: {
      color: theme.textMuted,
      fontSize: typography.role.caption.fontSize,
      lineHeight: typography.role.caption.lineHeight,
      marginTop: 2,
    },
    drawerClose: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    drawerDivider: {
      backgroundColor: theme.border,
      height: 1,
      marginHorizontal: spacing[5],
    },
    drawerMenu: { gap: spacing[1], padding: spacing[4] },
    drawerAuthActions: {
      borderTopColor: theme.border,
      borderTopWidth: 1,
      gap: spacing[2],
      marginTop: spacing[3],
      paddingTop: spacing[4],
    },
    drawerAuthButton: { alignSelf: "stretch" },
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
    body: {
      gap: spacing[5],
      paddingHorizontal: spacing[5],
    },
    continueSection: { zIndex: 2 },
    continueCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.card,
      padding: spacing[4],
      ...cardShadow,
      zIndex: 1,
    },
    continueHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    continueCopy: { flex: 1, gap: 2 },
    cardTitle: {},
    cardSubtitle: {},
    continueButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.button,
      elevation: 0,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[4],
      minHeight: 46,
      paddingVertical: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    statsGrid: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.card,
      flexDirection: "row",
      overflow: "hidden",
      paddingVertical: spacing[4],
      ...cardShadow,
    },
    statCard: {
      alignItems: "center",
      flex: 1,
      gap: 2,
      paddingHorizontal: spacing[2],
    },
    statCardDivider: {
      borderLeftColor: theme.border,
      borderLeftWidth: 1,
    },
    statValue: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      textAlign: "center",
    },
    section: { gap: spacing[2] },
    sectionTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    quickAction: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[4],
      padding: spacing[4],
      ...cardShadow,
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
    quickTitle: {},
    quickDescription: {},
    pressed: { opacity: 0.94 },
    drawerPlanBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: theme.primarySubtle,
      borderColor: "transparent",
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[1],
      marginTop: spacing[2],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    drawerPlanText: {
      color: theme.primary,
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
      fontWeight: typography.weight.semibold,
    },
  });
};

export default HomeScreen;
