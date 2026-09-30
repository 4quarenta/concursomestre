import React from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { LogoutConfirmationSheet } from "@/components/LogoutConfirmationSheet";
import { AppButton, AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { useAuth } from "@/providers/AuthProvider";
import { getAssetUrl } from "@/services/api/client";
import { statisticsService } from "@/services/statistics/statisticsService";
import type { UserStatistics } from "@/types/statistics";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  path?: string;
  accent?: boolean;
};

const menuSections: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: "Configurações",
    items: [
      {
        icon: "contrast-outline",
        label: "Aparência",
        description: "Modo claro, escuro ou do sistema",
        path: "/configuracoes/aparencia",
      },
      {
        icon: "lock-closed-outline",
        label: "Conta",
        description: "Email e senha",
        path: "/configuracoes/conta",
      },
    ],
  },
  {
    title: "Outros",
    items: [
      {
        icon: "star-outline",
        label: "Avaliar o app",
        description: "Sua opinião importa",
      },
      {
        icon: "help-circle-outline",
        label: "Ajuda e suporte",
        description: "FAQ e contato",
        path: "/ajuda",
      },
    ],
  },
];

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

const formatStudyDuration = (seconds: number): string => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ""}` : `${minutes}min`;
};

export const ProfileScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, logout, isGuest } = useAuth();
  const isVisitor = isGuest || !user;
  const isPreview = user?.id === "visual-preview-user";
  const name = user?.name || "Visitante";
  const email = user?.email || "--";
  const plan = user?.plan || user?.subscription?.plan?.name || "Gratuito";
  const photoUri = user?.photoUrl ? getAssetUrl(user.photoUrl) : "";
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [logoutConfirmationVisible, setLogoutConfirmationVisible] =
    React.useState(false);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    if (!user?.id) {
      setStats(EMPTY_STATS);
      return () => { active = false; };
    }
    void Promise.allSettled([
      statisticsService.getUserStatistics(user.id),
      statisticsService.getCurrentUserAnswerSnapshot(),
    ]).then(([statisticsResult, answersResult]) => {
      if (!active) return;
      const base = statisticsResult.status === "fulfilled" ? statisticsResult.value : EMPTY_STATS;
      if (answersResult.status === "fulfilled") {
        setStats({
          ...base,
          ...answersResult.value.summary,
          subjectBreakdown: answersResult.value.subjectBreakdown.length > 0
            ? answersResult.value.subjectBreakdown
            : base.subjectBreakdown,
        });
      } else {
        setStats(base);
      }
    });
    return () => { active = false; };
  }, [user?.id]));

  const confirmLogout = () => setLogoutConfirmationVisible(true);
  const handleLogout = () => {
    setLogoutConfirmationVisible(false);
    void logout();
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.path) {
      router.push(item.path as never);
      return;
    }
    Alert.alert(
      "Avaliar o app",
      "Obrigado por ajudar a melhorar o ConcursoMestre.",
    );
  };

  const focus = user?.targetExam?.trim() || "Não definido";
  const profileStats = [
    {
      label: "Questões",
      value: isPreview ? "1.248" : stats.totalQuestionsAnswered.toLocaleString("pt-BR"),
      icon: "book-outline" as const,
    },
    {
      label: "Acerto",
      value: isPreview ? "78%" : `${Math.round(stats.accuracyRate)}%`,
      icon: "locate-outline" as const,
    },
    {
      label: "Tempo de estudo",
      value: isPreview ? "86h" : formatStudyDuration(stats.totalStudyTime),
      icon: "time-outline" as const,
    },
  ];
  const visibleMenuSections = isVisitor
    ? menuSections.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label !== "Conta"),
      })).filter((section) => section.items.length > 0)
    : menuSections;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageTitleRow}>
          <AppText variant="screenTitle">Perfil</AppText>
        </View>

        {isVisitor ? (
          <AppSurface variant="outlined" style={styles.guestCard}>
            <View style={styles.guestIcon}>
              <Ionicons name="person-outline" size={21} color={theme.primary} />
            </View>
            <AppText variant="sectionTitle">Acesse sua conta</AppText>
            <AppText variant="body" tone="muted" style={styles.guestDescription}>
              Entre ou crie uma conta para salvar seu progresso e aproveitar todos os recursos.
            </AppText>
            <AppButton label="Entrar" onPress={() => router.push("/login")} style={styles.guestButton} />
            <AppButton
              label="Criar conta"
              variant="secondary"
              onPress={() => router.push("/cadastro")}
              style={styles.guestButton}
            />
          </AppSurface>
        ) : null}

        {!isVisitor ? <AppSurface variant="outlined" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <AppText variant="screenTitle" style={styles.avatarInitial}>{name.trim().charAt(0).toUpperCase()}</AppText>
              )}
            </View>
            <View style={styles.headerCopy}>
              <AppText variant="sectionTitle" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.name}>
                {name}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>{email}</AppText>
            </View>
            <MotionPressable
              accessibilityRole="button"
              onPress={() => router.push("/perfil/editar")}
              style={styles.editButton}
            >
              <AppText variant="button" style={styles.editText}>Editar</AppText>
            </MotionPressable>
          </View>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`Foco de estudo: ${focus}. Editar perfil`}
            onPress={() => router.push("/perfil/editar")}
            style={styles.focusLine}
          >
            <Ionicons name="flag-outline" size={15} color={theme.primary} />
            <AppText variant="caption" tone="muted">Foco de estudo</AppText>
            <AppText variant="label" numberOfLines={1} style={styles.focusValue}>{focus}</AppText>
            <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
          </MotionPressable>
        </AppSurface> : null}

        {!isVisitor ? <View style={styles.stats}>
          {profileStats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Ionicons name={stat.icon} size={17} color={theme.primary} />
              <AppText variant="sectionTitle" numberOfLines={1} adjustsFontSizeToFit>{stat.value}</AppText>
              <AppText variant="label" tone="muted" style={styles.statLabel}>{stat.label}</AppText>
            </View>
          ))}
        </View> : null}

        {!isVisitor ? <View style={styles.section}>
          <AppText variant="sectionTitle">Estudo</AppText>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => router.push("/planos")}
            style={({ pressed }) => [styles.planCard, pressed && styles.menuItemPressed]}
          >
            <View style={styles.planIcon}>
              <Ionicons name="diamond-outline" size={21} color={theme.primary} />
            </View>
            <View style={styles.menuCopy}>
              <AppText variant="bodyStrong">Meu plano</AppText>
              <AppText variant="caption" tone="muted">{plan} · Acesse mais recursos</AppText>
            </View>
            <AppText variant="link">Ver planos</AppText>
          </MotionPressable>
        </View> : null}

        {visibleMenuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="sectionTitle">{section.title}</AppText>
            <View style={styles.menu}>
              {section.items.map((item, index) => (
                <MotionPressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => handleMenuPress(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    index > 0 && styles.menuItemBorder,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      item.accent && styles.menuIconAccent,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={17}
                      color={item.accent ? theme.onPrimary : theme.text}
                    />
                  </View>
                  <View style={styles.menuCopy}>
                    <AppText variant="bodyStrong">{item.label}</AppText>
                    <AppText variant="caption" tone="muted">
                      {item.description === "Gratuito"
                        ? plan
                        : item.description}
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={theme.textMuted}
                  />
                </MotionPressable>
              ))}
            </View>
          </View>
        ))}

        {!isVisitor ? <MotionPressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logout,
            pressed && styles.logoutPressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <AppText variant="bodyStrong" tone="danger">Sair da conta</AppText>
        </MotionPressable> : null}
        <AppText variant="label" tone="muted" style={styles.version}>
          Versão 1.0.0
        </AppText>
      </ScrollView>
      {!isVisitor ? <LogoutConfirmationSheet
        visible={logoutConfirmationVisible}
        onDismiss={() => setLogoutConfirmationVisible(false)}
        onConfirm={handleLogout}
      /> : null}
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: { paddingBottom: spacing[8], paddingHorizontal: spacing[5], paddingTop: spacing[5] },
    pageTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing[4],
    },
    guestCard: {
      alignItems: "center",
      gap: spacing[3],
      marginBottom: spacing[4],
      padding: spacing[5],
    },
    guestIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    guestDescription: { maxWidth: 300, textAlign: "center" },
    guestButton: { alignSelf: "stretch" },
    profileCard: {
      padding: spacing[4],
    },
    profileHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
    },
    avatar: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.lg,
      height: 64,
      justifyContent: "center",
      overflow: "hidden",
      width: 64,
    },
    avatarImage: { height: "100%", width: "100%" },
    avatarInitial: { color: theme.primary },
    headerCopy: { flex: 1 },
    name: { color: theme.text },
    focusLine: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[2],
      marginTop: spacing[2],
      minHeight: 34,
    },
    focusValue: { color: theme.text, flex: 1 },
    editButton: {
      borderColor: theme.border,
      borderRadius: radius.button,
      borderWidth: 1,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    editText: {
      color: theme.primary,
      fontSize: typography.role.button.fontSize,
      lineHeight: typography.role.button.lineHeight,
      fontWeight: typography.weight.semibold,
    },
    stats: { flexDirection: "row", gap: spacing[2], paddingVertical: spacing[4] },
    stat: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      borderColor: theme.border,
      borderWidth: 1,
      flex: 1,
      gap: 3,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[3],
    },
    statLabel: { textAlign: "center" },
    section: {
      gap: spacing[2],
      marginBottom: spacing[4],
    },
    planCard: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      minHeight: 72,
      padding: spacing[3],
    },
    planIcon: {
      alignItems: "center",
      backgroundColor: theme.primarySubtle,
      borderRadius: radius.md,
      height: 43,
      justifyContent: "center",
      width: 43,
    },
    menu: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    menuItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[4],
    },
    menuItemBorder: { borderTopColor: theme.border, borderTopWidth: 1 },
    menuItemPressed: { backgroundColor: theme.surfaceSubtle },
    menuIcon: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    menuIconAccent: { backgroundColor: theme.primary },
    menuCopy: { flex: 1 },
    logout: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      marginHorizontal: spacing[5],
      paddingVertical: spacing[3],
    },
    logoutPressed: { opacity: 0.7 },
    version: {
      paddingTop: spacing[2],
      textAlign: "center",
    },
  });

export default ProfileScreen;
