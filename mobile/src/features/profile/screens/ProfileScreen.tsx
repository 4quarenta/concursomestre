import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as StoreReview from "expo-store-review";
import { LogoutConfirmationSheet } from "@/components/LogoutConfirmationSheet";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { AppButton, AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { useAuth } from "@/providers/AuthProvider";
import { getAssetUrl } from "@/services/api/client";
import { statisticsService } from "@/services/statistics/statisticsService";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import { resolveCanonicalPlanKey } from "@/services/plans/planDetails";
import type { UserStatistics } from "@/types/statistics";
import { darkTheme, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { user, logout, isGuest, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [focusPickerVisible, setFocusPickerVisible] = React.useState(false);
  // Prefetch while the profile is visible so opening the picker does not start
  // the full practice-taxonomy request on the same tap.
  const taxonomiesQuery = useQuestionTaxonomiesQuery({ enabled: Boolean(user?.id && !isGuest) });
  const isVisitor = isGuest || !user;
  const isPreview = user?.id === "visual-preview-user";
  const name = user?.name || "Visitante";
  const email = user?.email || "--";
  const plan = user?.plan || user?.subscription?.plan?.name || "Gratuito";
  const isElitePlan = resolveCanonicalPlanKey(plan) === "Elite";
  const isDarkTheme = theme.background === darkTheme.background;
  const eliteAccent = isDarkTheme ? "#EFC766" : "#9A6A0A";
  const eliteBorder = isDarkTheme ? "#80652B" : "#D9B45D";
  const eliteSurface = isDarkTheme ? "#282316" : "#FFFAF0";
  const photoUri = user?.photoUrl ? getAssetUrl(user.photoUrl) : "";
  const [stats, setStats] = React.useState<UserStatistics>(EMPTY_STATS);
  const [logoutConfirmationVisible, setLogoutConfirmationVisible] =
    React.useState(false);
  const [isRequestingReview, setIsRequestingReview] = React.useState(false);
  const [focusSearch, setFocusSearch] = React.useState("");
  const deferredFocusSearch = React.useDeferredValue(focusSearch.trim());
  const [isSavingFocus, setIsSavingFocus] = React.useState(false);

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

  const openFocusPicker = () => {
    setFocusSearch("");
    setFocusPickerVisible(true);
    if (taxonomiesQuery.isError) void taxonomiesQuery.refetch();
  };

  const saveFocus = async (value: string) => {
    if (!user || isSavingFocus) return;
    if (value === user.targetExam) {
      setFocusPickerVisible(false);
      return;
    }

    setIsSavingFocus(true);
    try {
      await updateUser({ targetExam: value });
      setFocusPickerVisible(false);
      Alert.alert("Foco de estudo", "Seu foco foi atualizado.");
    } catch (error) {
      Alert.alert(
        "Foco de estudo",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar seu foco.",
      );
    } finally {
      setIsSavingFocus(false);
    }
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.path) {
      router.push(item.path as never);
      return;
    }
    if (item.label !== "Avaliar o app" || isRequestingReview) return;
    if (Platform.OS !== "android") {
      Alert.alert(
        "Avaliação pelo Google Play",
        "A avaliação pelo Google Play está disponível no aplicativo Android.",
      );
      return;
    }

    void (async () => {
      setIsRequestingReview(true);
      try {
        if (!(await StoreReview.isAvailableAsync())) {
          Alert.alert(
            "Avaliação indisponível",
            "O Google Play não disponibilizou a avaliação neste dispositivo. Tente novamente mais tarde.",
          );
          return;
        }
        await StoreReview.requestReview();
      } catch {
        Alert.alert(
          "Avaliação indisponível",
          "Não foi possível iniciar a avaliação agora. Tente novamente mais tarde.",
        );
      } finally {
        setIsRequestingReview(false);
      }
    })();
  };

  const focus = user?.targetExam?.trim() || "Não definido";
  const focusOptions = React.useMemo(() => {
    const search = deferredFocusSearch.toLocaleLowerCase("pt-BR");
    return (taxonomiesQuery.data?.carreiras || [])
      .filter((option) => !search || option.nome.toLocaleLowerCase("pt-BR").includes(search));
  }, [deferredFocusSearch, taxonomiesQuery.data?.carreiras]);
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
            accessibilityLabel={`Foco de estudo: ${focus}. Alterar foco`}
            onPress={openFocusPicker}
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
            accessibilityLabel={`Meu plano atual: ${plan}${isElitePlan ? ", Elite, acesso máximo" : ""}. Abrir planos`}
            onPress={() => router.push("/planos")}
            style={({ pressed }) => [
              styles.planCard,
              isElitePlan && {
                backgroundColor: eliteSurface,
                borderColor: eliteBorder,
              },
              pressed && styles.menuItemPressed,
            ]}
          >
            <View
              style={[
                styles.planIcon,
                isElitePlan && {
                  backgroundColor: isDarkTheme ? "#443819" : "#F5E8C8",
                  borderColor: isDarkTheme ? "#80652B" : "#E8D19A",
                },
              ]}
            >
              <Ionicons
                name={isElitePlan ? "diamond" : "diamond-outline"}
                size={21}
                color={isElitePlan ? eliteAccent : theme.primary}
              />
            </View>
            <View style={styles.menuCopy}>
              <AppText
                variant="label"
                tone="muted"
                style={isElitePlan && { color: eliteAccent }}
              >
                PLANO ATUAL
              </AppText>
              <AppText variant="sectionTitle" style={styles.planName}>
                {plan}
              </AppText>
              {isElitePlan ? (
                <View style={styles.eliteCaption}>
                  <Ionicons name="sparkles" size={12} color={eliteAccent} />
                  <AppText variant="caption" style={{ color: eliteAccent }}>
                    Acesso máximo ativo
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" tone="muted">
                  Gerencie sua assinatura
                </AppText>
              )}
            </View>
            <View
              style={[
                styles.planArrow,
                isElitePlan && {
                  backgroundColor: isDarkTheme ? "#443819" : "#F5E8C8",
                  borderColor: isDarkTheme ? "#80652B" : "#E8D19A",
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={17}
                color={isElitePlan ? eliteAccent : theme.textMuted}
              />
            </View>
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
                  accessibilityState={{
                    disabled: item.label === "Avaliar o app" && isRequestingReview,
                    busy: item.label === "Avaliar o app" && isRequestingReview,
                  }}
                  disabled={item.label === "Avaliar o app" && isRequestingReview}
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
      {!isVisitor ? (
        <AnimatedModal
          visible={focusPickerVisible}
          mode="sheet"
          transparent
          onRequestClose={() => setFocusPickerVisible(false)}
        >
          <View style={styles.focusModalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar seleção de foco"
              onPress={() => setFocusPickerVisible(false)}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.focusModal,
                { paddingBottom: Math.max(insets.bottom, spacing[4]) },
              ]}
            >
              <View style={styles.focusModalHeader}>
                <View style={styles.focusModalHeading}>
                  <AppText variant="sectionTitle">Foco de estudo</AppText>
                  <AppText variant="caption" tone="muted">
                    Escolha uma área cadastrada na plataforma.
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                  onPress={() => setFocusPickerVisible(false)}
                  style={styles.focusModalClose}
                >
                  <Ionicons name="close" size={21} color={theme.textMuted} />
                </Pressable>
              </View>

              <View style={styles.focusSearch}>
                <Ionicons name="search-outline" size={17} color={theme.textMuted} />
                <TextInput
                  value={focusSearch}
                  onChangeText={setFocusSearch}
                  placeholder="Buscar área"
                  placeholderTextColor={theme.textSubtle}
                  style={styles.focusSearchInput}
                  autoCapitalize="none"
                  editable={!isSavingFocus}
                />
              </View>

              {taxonomiesQuery.isLoading ? (
                <View style={styles.focusState}>
                  <ActivityIndicator color={theme.primary} />
                  <AppText variant="caption" tone="muted">Carregando áreas...</AppText>
                </View>
              ) : taxonomiesQuery.isError ? (
                <View style={styles.focusState}>
                  <AppText variant="body" tone="muted" style={styles.focusStateText}>
                    Não foi possível carregar as áreas agora.
                  </AppText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void taxonomiesQuery.refetch()}
                    style={styles.focusRetry}
                  >
                    <AppText variant="button" style={{ color: theme.primary }}>
                      Tentar novamente
                    </AppText>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={focusOptions}
                  extraData={user?.targetExam}
                  keyExtractor={(option) => String(option.id ?? option.slug ?? option.nome)}
                  style={styles.focusList}
                  contentContainerStyle={styles.focusListContent}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={5}
                  ListEmptyComponent={(
                    <AppText variant="caption" tone="muted" style={styles.focusStateText}>
                      {taxonomiesQuery.data?.carreiras.length
                        ? "Nenhuma área corresponde à busca."
                        : "Não há áreas disponíveis cadastradas na plataforma."}
                    </AppText>
                  )}
                  renderItem={({ item: option }) => {
                    const selected = option.nome === user?.targetExam;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: isSavingFocus }}
                        disabled={isSavingFocus}
                        onPress={() => void saveFocus(option.nome)}
                        style={[
                          styles.focusOption,
                          {
                            backgroundColor: selected
                              ? theme.primarySubtle
                              : theme.surfaceSubtle,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.focusOptionText,
                            { color: selected ? theme.primary : theme.text },
                          ]}
                        >
                          {option.nome}
                        </Text>
                        <Ionicons
                          name={selected ? "checkmark-circle" : "chevron-forward"}
                          size={19}
                          color={selected ? theme.primary : theme.textMuted}
                        />
                      </Pressable>
                    );
                  }}
                />
              )}
              {isSavingFocus ? (
                <AppText variant="caption" tone="muted" style={styles.focusSaving}>
                  Salvando foco...
                </AppText>
              ) : null}
            </View>
          </View>
        </AnimatedModal>
      ) : null}
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
    focusModalBackdrop: {
      backgroundColor: "rgba(0,0,0,0.52)",
      flex: 1,
      justifyContent: "flex-end",
    },
    focusModal: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      gap: spacing[3],
      maxHeight: "86%",
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
    },
    focusModalHeader: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
    focusModalHeading: { flex: 1, gap: spacing[1] },
    focusModalClose: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.button,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    focusSearch: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.field,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      paddingHorizontal: spacing[3],
    },
    focusSearchInput: {
      color: theme.text,
      flex: 1,
      fontSize: typography.role.body.fontSize,
      minHeight: 48,
      paddingVertical: spacing[2],
    },
    focusList: { maxHeight: 440 },
    focusListContent: { gap: spacing[2], paddingBottom: spacing[2] },
    focusOption: {
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 52,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    focusOptionText: {
      flex: 1,
      fontSize: typography.role.body.fontSize,
      fontWeight: typography.weight.medium,
    },
    focusState: {
      alignItems: "center",
      gap: spacing[3],
      justifyContent: "center",
      minHeight: 180,
      padding: spacing[4],
    },
    focusStateText: { textAlign: "center" },
    focusRetry: {
      borderColor: theme.border,
      borderRadius: radius.button,
      borderWidth: 1,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    focusSaving: { textAlign: "center" },
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
      borderColor: "transparent",
      borderRadius: radius.md,
      borderWidth: 1,
      height: 43,
      justifyContent: "center",
      width: 43,
    },
    planName: { color: theme.text },
    eliteCaption: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[1],
    },
    planArrow: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
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
