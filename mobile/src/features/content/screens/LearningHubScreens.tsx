import React from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { MotionPressable } from "@/components/ui/Primitives";
import { borders, palette, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useAuth } from "@/providers/AuthProvider";
import { CHECKOUT_ADHESION_TERMS_VERSION } from "@/services/legal/legalDocumentVersion";
import { planService } from "@/services/plans/planService";
import { getPublicPlanBenefits } from "@/services/plans/publicPlanBenefits";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
import {
  getMissingCheckoutProfileFields,
} from "@/services/plans/checkoutRequirements";
import {
  isPlanEnabledByName,
  resolveCanonicalPlanKey,
  resolveConfiguredPlanCycleAmount,
  resolveConfiguredPlanDisplayName,
} from "@/services/plans/planDetails";
import type { Plan } from "@/types/plans";

const modules = [
  { title: "Concordância Verbal", lessons: 8, completed: 8 },
  { title: "Regência Verbal", lessons: 6, completed: 6 },
  { title: "Crase", lessons: 5, completed: 3, current: true },
  { title: "Pontuação", lessons: 7, completed: 0 },
  { title: "Interpretação de Texto", lessons: 10, completed: 0, locked: true },
  { title: "Redação Oficial", lessons: 4, completed: 0, locked: true },
];

const tracks = [
  {
    title: "Trilha completa INSS",
    description: "Do zero à aprovação em 90 dias",
    modules: 12,
    duration: "90 dias",
    enrolled: "4.280",
    progress: 42,
  },
  {
    title: "Português para concursos",
    description: "Gramática e interpretação focados",
    modules: 8,
    duration: "30 dias",
    enrolled: "8.120",
    progress: 78,
  },
  {
    title: "Direito Constitucional",
    description: "Constituição comentada artigo por artigo",
    modules: 10,
    duration: "45 dias",
    enrolled: "2.150",
    progress: 0,
  },
];

const getPlanCycleLabel = (plan: Plan) => {
  if (plan.interval_unit === "year") return "ano";
  if (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 3)
    return "trimestre";
  if (plan.interval_unit === "month") return "mês";
  if (plan.interval_unit === "week")
    return Number(plan.interval_count || 1) === 1
      ? "semana"
      : `${plan.interval_count} semanas`;
  return Number(plan.interval_count || 1) === 1
    ? "dia"
    : `${plan.interval_count} dias`;
};

const formatPlanAmount = (amount: number) =>
  `R$ ${Math.max(0, amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BackGradientHeader = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) => {
  const theme = useAppTheme();
  return (
    <LinearGradient
      colors={[palette.brand.lavender, palette.brand.navy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientHeader, { paddingTop: spacing[5] }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Ionicons name="arrow-back" size={22} color={theme.onPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.onPrimary }]}>
            {title}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.8)" }]}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons name={icon} size={28} color={theme.warning} />
      </View>
    </LinearGradient>
  );
};

export function TracksScreen() {
  const theme = useAppTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <BackGradientHeader
        title="Trilhas de estudo"
        subtitle="Caminhos personalizados para sua aprovação"
        icon="sparkles-outline"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.currentCard, { backgroundColor: theme.surface }]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.overline, { color: theme.primary }]}>
                EM ANDAMENTO
              </Text>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Português para concursos
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                Módulo atual:{" "}
                <Text style={{ fontWeight: typography.weight.bold }}>
                  Crase
                </Text>
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={[styles.percent, { color: theme.primary }]}>
                78%
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                concluído
              </Text>
            </View>
          </View>
          <ProgressBar value={78} color={theme.primary} />
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="play" size={16} color={theme.onPrimary} />
            <Text
              style={[styles.primaryButtonText, { color: theme.onPrimary }]}
            >
              Continuar de onde parei
            </Text>
          </Pressable>
        </View>
        <SectionTitle title="Módulos" theme={theme} />
        <View style={styles.list}>
          {modules.map((item, index) => {
            const done = item.completed === item.lessons;
            const percent = (item.completed / item.lessons) * 100;
            return (
              <View
                key={item.title}
                style={[
                  styles.moduleRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: item.current ? theme.primary : "transparent",
                  },
                  item.current && styles.currentBorder,
                ]}
              >
                <View
                  style={[
                    styles.moduleNumber,
                    {
                      backgroundColor: item.locked
                        ? theme.surfaceSubtle
                        : done
                          ? theme.successSubtle
                          : item.current
                            ? theme.primary
                            : theme.primarySubtle,
                    },
                  ]}
                >
                  {item.locked ? (
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color={theme.textMuted}
                    />
                  ) : done ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.success}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.moduleNumberText,
                        {
                          color: item.current ? theme.onPrimary : theme.primary,
                        },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <Text
                    style={[
                      styles.moduleTitle,
                      { color: item.locked ? theme.textMuted : theme.text },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.progressRow}>
                    <View
                      style={[
                        styles.miniTrack,
                        { backgroundColor: theme.surfaceSubtle },
                      ]}
                    >
                      <View
                        style={[
                          styles.miniProgress,
                          {
                            backgroundColor: done
                              ? theme.success
                              : theme.primary,
                            width: `${percent}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.tiny, { color: theme.textMuted }]}>
                      {item.completed}/{item.lessons}
                    </Text>
                  </View>
                </View>
                {!item.locked && (
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={theme.textMuted}
                  />
                )}
              </View>
            );
          })}
        </View>
        <SectionTitle title="Explorar trilhas" theme={theme} />
        <View style={styles.list}>
          {tracks.map((track) => (
            <Pressable
              key={track.title}
              accessibilityRole="button"
              style={[styles.trackCard, { backgroundColor: theme.surface }]}
            >
              <View
                style={[styles.trackIcon, { backgroundColor: theme.primary }]}
              >
                <Ionicons
                  name="book-outline"
                  size={23}
                  color={theme.onPrimary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.moduleTitle, { color: theme.text }]}>
                  {track.title}
                </Text>
                <Text style={[styles.caption, { color: theme.textMuted }]}>
                  {track.description}
                </Text>
                <Text style={[styles.tiny, { color: theme.textMuted }]}>
                  {track.modules} módulos · {track.duration} · {track.enrolled}{" "}
                  alunos
                </Text>
                {track.progress > 0 && (
                  <ProgressBar
                    value={track.progress}
                    color={theme.primary}
                    compact
                  />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


export function PlansScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDarkTheme = theme.background === palette.slate[900];
  const { user, systemSettings, refreshProfile } = useAuth();
  const [plansData, setPlansData] = React.useState<Plan[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [openingCheckoutPlanId, setOpeningCheckoutPlanId] =
    React.useState<number | null>(null);
  const [termsPlan, setTermsPlan] = React.useState<Plan | null>(null);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [showAdhesionTerms, setShowAdhesionTerms] = React.useState(false);
  const checkoutOpenedRef = React.useRef(false);
  React.useEffect(() => {
    let isMounted = true;
    planService.getPlans().then((plans) => {
      if (!isMounted) return;
      setPlansData(
        plans.filter(
          (plan) =>
            plan.is_active !== false &&
            isPlanEnabledByName(plan.name, systemSettings.planDetails),
        ),
      );
    }).catch(() => {
      if (isMounted) setLoadError("Não foi possível carregar os planos agora.");
    }).finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [systemSettings.planDetails]);
  const visiblePlans = React.useMemo(() => {
    const plansByTier = new Map<string, Plan[]>();

    plansData
      .filter((plan) => plan.is_test_plan !== true)
      .forEach((plan) => {
        const canonicalName = resolveCanonicalPlanKey(plan.name) || plan.name;
        const variants = plansByTier.get(canonicalName) || [];
        variants.push(plan);
        plansByTier.set(canonicalName, variants);
      });

    return Array.from(plansByTier.entries())
      .sort(([left], [right]) => {
        const order = { Gratuito: 0, Essencial: 1, Pro: 2, Elite: 3 };
        return (
          (order[left as keyof typeof order] ?? 99) -
          (order[right as keyof typeof order] ?? 99)
        );
      })
      .map(([, variants]) => {
        const cycleRank = (plan: Plan) => {
          if (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 1) return 0;
          if (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 3) return 1;
          if (plan.interval_unit === "year") return 2;
          if (plan.interval_unit === "week") return 3;
          return 4;
        };
        return [...variants].sort(
          (left, right) => cycleRank(left) - cycleRank(right),
        )[0];
      });
  }, [plansData]);

  const currentPlanId = React.useMemo(() => {
    if (!user) return undefined;

    const subscription = user.subscription;
    const subscriptionStatus = String(subscription?.status || "")
      .trim()
      .toLowerCase();
    const hasCurrentSubscription = ["active", "trialing", "past_due"].includes(
      subscriptionStatus,
    );

    if (hasCurrentSubscription) {
      const subscribedPlanId = subscription?.plan_id ?? subscription?.plan?.id;
      if (subscribedPlanId !== undefined && subscribedPlanId !== null) {
        return visiblePlans.find(
          (plan) => String(plan.id) === String(subscribedPlanId),
        )?.id;
      }

      const subscribedPlanName =
        subscription?.plan?.displayName ||
        subscription?.plan?.name ||
        user.plan;
      const subscribedPlanKey = subscribedPlanName
        ? resolveCanonicalPlanKey(subscribedPlanName)
        : null;
      if (!subscribedPlanKey) return undefined;
      return visiblePlans.find(
        (plan) => resolveCanonicalPlanKey(plan.name) === subscribedPlanKey,
      )?.id;
    }

    // Sem assinatura com acesso vigente, o plano gratuito é a oferta atual
    // para uma conta autenticada; não reaproveitamos nome de plano antigo.
    return visiblePlans.find(
      (plan) =>
        resolveCanonicalPlanKey(plan.name) === "Gratuito" &&
        Number(plan.price || 0) <= 0,
    )?.id;
  }, [user, visiblePlans]);

  // O destaque comercial "Mais escolhido" deve existir em apenas um card.
  // Reservamos o selo ao plano Pro, sem atribuir essa alegação a outro plano.
  const mostChosenPlanId = React.useMemo(() => {
    const pro = visiblePlans.find(
      (plan) => resolveCanonicalPlanKey(plan.name) === "Pro",
    );
    return pro?.id;
  }, [visiblePlans]);

  const startCheckout = async (plan: Plan) => {
    setOpeningCheckoutPlanId(plan.id);
    try {
      // Garante que o access token ainda esteja valido antes de criar a
      // sessao Stripe. O cliente HTTP tenta rotacionar o refresh token se
      // o access token tiver expirado.
      await refreshProfile();

      const checkout = await planService.createStripeCheckoutSession({
        plan_id: plan.id,
        auto_renew: true,
        checkout_attempt_id: `mobile_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 10)}`,
        checkout_adhesion_terms_accepted: true,
        checkout_adhesion_terms_version: CHECKOUT_ADHESION_TERMS_VERSION,
      });

      if (checkout.mode === "local_credit") {
        await refreshProfile();
        Alert.alert(
          "Assinatura ativada",
          "Seu plano foi ativado usando o crédito disponível na conta.",
        );
        return;
      }

      const checkoutUrl = String(checkout.url || checkout.redirect_url || "").trim();
      if (!/^https:\/\//i.test(checkoutUrl)) {
        throw new Error("A Stripe retornou uma URL de checkout inválida.");
      }

      const safeCheckoutUrl = assertAllowedExternalUrl(checkoutUrl, "checkout");
      if (!(await Linking.canOpenURL(safeCheckoutUrl))) {
        throw new Error("Não foi possível abrir o checkout no aparelho.");
      }

      checkoutOpenedRef.current = true;
      await Linking.openURL(safeCheckoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/complete seu perfil|confirme o e-mail/i.test(message)) {
        router.push({
          pathname: "/perfil/editar",
          params: { checkout: "1" },
        });
        return;
      }
      const isExpiredSession = /sess[aã]o.*(inv[aá]lida|expirada)/i.test(message);
      Alert.alert(
        isExpiredSession ? "Sessão expirada" : "Assinatura",
        isExpiredSession
          ? "Faça login novamente para iniciar o checkout da Stripe."
          : message || "Não foi possível iniciar o checkout.",
      );
    } finally {
      setOpeningCheckoutPlanId(null);
    }
  };

  const openCheckout = (plan: Plan) => {
    if (openingCheckoutPlanId !== null) return;
    if (!user) {
      Alert.alert("Assinatura", "Entre na sua conta para escolher um plano.");
      return;
    }
    if (Number(plan.price || 0) <= 0) {
      Alert.alert("Plano gratuito", "Este plano não exige checkout.");
      return;
    }

    if (getMissingCheckoutProfileFields(user).length > 0) {
      router.push({
        pathname: "/perfil/editar",
        params: { checkout: "1" },
      });
      return;
    }

    setTermsPlan(plan);
    setTermsAccepted(false);
    setShowAdhesionTerms(true);
  };

  const closeAdhesionTerms = () => {
    if (openingCheckoutPlanId !== null) return;
    setShowAdhesionTerms(false);
    setTermsPlan(null);
    setTermsAccepted(false);
  };

  const confirmAdhesionTerms = () => {
    if (!termsAccepted || !termsPlan || openingCheckoutPlanId !== null) return;
    const selectedPlan = termsPlan;
    setShowAdhesionTerms(false);
    setTermsPlan(null);
    setTermsAccepted(false);
    void startCheckout(selectedPlan);
  };

  const openFullAdhesionTerms = async () => {
    const termsUrl = assertAllowedExternalUrl(
      "https://concursomestre.com/checkout/termos-de-adesao",
      "termo de adesão",
    );
    try {
      await Linking.openURL(termsUrl);
    } catch {
      Alert.alert(
        "Termo de adesão",
        "Não foi possível abrir o documento agora. Tente novamente.",
      );
    }
  };

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !checkoutOpenedRef.current) return;
      checkoutOpenedRef.current = false;
      void refreshProfile().catch(() => {
        // O webhook Stripe continua sendo a fonte de verdade; uma falha
        // momentanea ao voltar ao app nao invalida a compra.
      });
    });

    return () => subscription.remove();
  }, [refreshProfile]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Planos"
        subtitle="Escolha o nível de acesso ideal para você"
      />
      <ScrollView
        contentContainerStyle={[
          styles.plansContent,
          {
            paddingBottom:
              spacing[8] +
              (Platform.OS === "android"
                ? Math.max(insets.bottom, spacing[12])
                : insets.bottom),
          },
        ]}
      >
        <Text style={[styles.plansIntro, { color: theme.textMuted }]}>
          Continue estudando com os recursos que fazem sentido para sua preparação.
        </Text>
        {isLoading ? (
          <View
            style={[styles.loadingCard, { backgroundColor: theme.surface }]}
          >
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              Carregando planos reais...
            </Text>
          </View>
        ) : null}
        {!isLoading && loadError ? (
          <View
            style={[styles.emptyPlanCard, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={24}
              color={theme.textMuted}
            />
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              Planos temporariamente indisponíveis
            </Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              {loadError}
            </Text>
          </View>
        ) : null}
        {!isLoading && !loadError && visiblePlans.length === 0 ? (
          <View
            style={[styles.emptyPlanCard, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="pricetags-outline"
              size={24}
              color={theme.textMuted}
            />
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              Nenhum plano publicado
            </Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              O catálogo será exibido assim que o administrador publicar os
              planos.
            </Text>
          </View>
        ) : null}
        <View style={styles.plansList}>
          {visiblePlans.map((plan) => {
            const canonicalName =
              resolveCanonicalPlanKey(plan.name) || plan.name;
            const cycleAmount =
              plan.interval_unit === "day" || plan.interval_unit === "week"
                ? Number(plan.price || 0)
                : resolveConfiguredPlanCycleAmount(
                    plan,
                    systemSettings.pricing,
                  );
            const isElite = canonicalName === "Elite";
            const isMostChosen = plan.id === mostChosenPlanId;
            const isCurrent = currentPlanId === plan.id;
            const features = getPublicPlanBenefits(
              plan,
              systemSettings.planEntitlements,
              systemSettings.planUsageLimits,
            );
            const eliteAccent = isDarkTheme ? "#EFC766" : "#BD861B";
            const eliteBorder = isDarkTheme ? "#9B782C" : "#D5AA4D";
            const eliteSurface = isDarkTheme ? "#282316" : "#FFFAF0";
            const badges = [
              isCurrent
                ? {
                    label: "Plano atual",
                    backgroundColor: theme.primarySubtle,
                    color: theme.primary,
                  }
                : null,
              isMostChosen
                ? {
                    label: "Mais escolhido",
                    backgroundColor: theme.primary,
                    color: theme.onPrimary,
                  }
                : null,
              isElite
                ? {
                    label: "Acesso máximo",
                    backgroundColor: isDarkTheme ? "#443819" : "#F3E1B7",
                    color: isDarkTheme ? "#F4D991" : "#60430C",
                  }
                : null,
            ].filter(Boolean) as Array<{
              label: string;
              backgroundColor: string;
              color: string;
            }>;
            return (
              <View
                key={plan.id}
                style={[
                  styles.planOption,
                  isDarkTheme ? shadows.cardDark : shadows.card,
                  {
                    backgroundColor: isElite ? eliteSurface : theme.surface,
                    borderColor: isElite
                      ? eliteBorder
                      : isMostChosen || isCurrent
                        ? theme.primary
                        : theme.border,
                    borderWidth: isElite || isMostChosen || isCurrent ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.planOptionHeader}>
                  <View style={styles.planOptionCopy}>
                    <Text style={[styles.planName, { color: theme.text }]}>
                      {resolveConfiguredPlanDisplayName(
                        plan.name,
                        systemSettings.planDetails,
                      )}
                    </Text>
                    {plan.description ? (
                      <Text style={[styles.planDescription, { color: theme.textMuted }]}>
                        {plan.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.planBadges}>
                    {badges.map((badge) => (
                      <Text
                        key={badge.label}
                        style={[
                          styles.planBadge,
                          { backgroundColor: badge.backgroundColor, color: badge.color },
                        ]}
                      >
                        {isElite && badge.label === "Acesso máximo" ? (
                          <Ionicons name="sparkles" size={11} color={badge.color} />
                        ) : null}{" "}
                        {badge.label}
                      </Text>
                    ))}
                  </View>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: theme.text }]}>
                    {formatPlanAmount(cycleAmount)}
                  </Text>
                  <Text style={[styles.planPeriod, { color: theme.textMuted }]}>
                    {Number(plan.price || 0) <= 0
                      ? "sem custo"
                      : `por ${getPlanCycleLabel(plan)}`}
                  </Text>
                </View>
                <View style={styles.planOptionFeatures}>
                  {features.map((feature) => (
                    <View key={feature.text} style={styles.planFeatureRow}>
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color={isElite ? eliteAccent : theme.primary}
                      />
                      <Text style={[styles.planFeatureText, { color: theme.text }]}>
                        {feature.text}
                      </Text>
                    </View>
                  ))}
                </View>
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isCurrent || openingCheckoutPlanId !== null,
                  }}
                  disabled={isCurrent || openingCheckoutPlanId !== null}
                  onPress={() => {
                    if (Number(plan.price || 0) <= 0) {
                      Alert.alert(
                        "Plano gratuito",
                        "O acesso gratuito não exige checkout nem cobrança.",
                      );
                      return;
                    }
                    void openCheckout(plan);
                  }}
                  style={[
                    styles.planCta,
                    {
                      backgroundColor: isElite
                        ? isDarkTheme
                          ? "#E0BB68"
                          : "#E4BD68"
                        : isMostChosen
                          ? theme.primary
                          : isCurrent
                            ? theme.surfaceSubtle
                            : theme.surface,
                      borderColor: isElite
                        ? eliteBorder
                        : isMostChosen || isCurrent
                          ? theme.primary
                          : theme.border,
                    },
                  ]}
                >
                  {openingCheckoutPlanId === plan.id ? (
                    <ActivityIndicator
                      size="small"
                      color={isElite || isMostChosen ? palette.brand.navy : theme.primary}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.planCtaText,
                        {
                          color: isElite
                            ? "#2B210D"
                            : isMostChosen
                              ? theme.onPrimary
                              : isCurrent
                                ? theme.textMuted
                                : theme.text,
                        },
                      ]}
                    >
                      {isCurrent
                        ? "Seu plano atual"
                        : isElite
                          ? "Explorar Elite"
                          : isMostChosen
                            ? "Conhecer Pro"
                            : canonicalName === "Gratuito"
                              ? "Começar grátis"
                              : "Conhecer " + canonicalName}
                    </Text>
                  )}
                  {!isCurrent && openingCheckoutPlanId !== plan.id ? (
                    <Ionicons
                      name={isElite ? "open-outline" : "arrow-forward"}
                      size={15}
                      color={
                        isElite
                          ? "#2B210D"
                          : isMostChosen
                            ? theme.onPrimary
                            : theme.text
                      }
                    />
                  ) : null}
                </MotionPressable>
              </View>
            );
          })}
        </View>

        <Text style={[styles.plansValueNote, { color: theme.textMuted }]}>
          Os valores e recursos acima são os publicados no catálogo da plataforma.
        </Text>
        <Text style={[styles.plansTerms, { color: theme.textMuted }]}>
          Confira as condições, o ciclo de cobrança e a renovação antes de confirmar a assinatura.
        </Text>
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={closeAdhesionTerms}
        transparent
        visible={showAdhesionTerms}
      >
        <View style={styles.adhesionBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar termo de adesão"
            onPress={closeAdhesionTerms}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.adhesionDialog,
              isDarkTheme ? shadows.modalDark : shadows.modal,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.adhesionHeading}>
              <View style={styles.adhesionHeadingCopy}>
                <Text style={[styles.adhesionTitle, { color: theme.text }]}>
                  Termo de adesão da assinatura
                </Text>
                <Text style={[styles.adhesionVersion, { color: theme.textMuted }]}>
                  Versão {CHECKOUT_ADHESION_TERMS_VERSION}
                </Text>
              </View>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={closeAdhesionTerms}
                style={styles.adhesionClose}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </MotionPressable>
            </View>
            <ScrollView
              style={styles.adhesionBody}
              contentContainerStyle={styles.adhesionBodyContent}
              showsVerticalScrollIndicator
            >
              {termsPlan ? (
                <View
                  style={[
                    styles.adhesionSelectedPlan,
                    { backgroundColor: theme.primarySubtle },
                  ]}
                >
                  <Text style={[styles.adhesionOverline, { color: theme.primary }]}>
                    Plano selecionado
                  </Text>
                  <Text style={[styles.adhesionSelectedPlanName, { color: theme.text }]}>
                    {resolveConfiguredPlanDisplayName(
                      termsPlan.name,
                      systemSettings.planDetails,
                    )}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.adhesionSectionTitle, { color: theme.text }]}>
                Antes de continuar
              </Text>
              <Text style={[styles.adhesionCopy, { color: theme.textMuted }]}>
                Estes termos regulam a contratação de planos pagos do ConcursoMestre. Ao concluir o checkout, você declara que leu, compreendeu e aceitou as condições da assinatura.
              </Text>
              <Text style={[styles.adhesionCopy, { color: theme.textMuted }]}>
                O plano contratado, o valor, a periodicidade, os benefícios ativos e eventuais descontos serão exibidos antes da confirmação da compra. A contratação depende da aprovação do pagamento.
              </Text>
              <MotionPressable
                accessibilityRole="link"
                onPress={() => void openFullAdhesionTerms()}
                style={styles.adhesionLink}
              >
                <Ionicons name="document-text-outline" size={17} color={theme.primary} />
                <Text style={[styles.adhesionLinkText, { color: theme.primary }]}>
                  Ler termo de adesão completo
                </Text>
                <Ionicons name="open-outline" size={15} color={theme.primary} />
              </MotionPressable>
              <Text style={[styles.adhesionHint, { color: theme.textMuted }]}>
                O documento completo será aberto no navegador. Depois, volte aqui para aceitar e seguir.
              </Text>
              <MotionPressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
                onPress={() => setTermsAccepted((accepted) => !accepted)}
                style={styles.adhesionConsent}
              >
                <View
                  style={[
                    styles.adhesionCheckbox,
                    {
                      borderColor: termsAccepted ? theme.primary : theme.borderStrong,
                      backgroundColor: termsAccepted ? theme.primary : theme.surface,
                    },
                  ]}
                >
                  {termsAccepted ? (
                    <Ionicons name="checkmark" size={15} color={theme.onPrimary} />
                  ) : null}
                </View>
                <Text style={[styles.adhesionConsentText, { color: theme.text }]}>
                  Li o termo de adesão e aceito as condições da assinatura.
                </Text>
              </MotionPressable>
            </ScrollView>
            <View style={styles.adhesionActions}>
              <MotionPressable
                accessibilityRole="button"
                onPress={closeAdhesionTerms}
                style={[
                  styles.adhesionCancel,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
              >
                <Text style={[styles.adhesionCancelText, { color: theme.text }]}>
                  Cancelar
                </Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !termsAccepted || openingCheckoutPlanId !== null,
                }}
                disabled={!termsAccepted || openingCheckoutPlanId !== null}
                onPress={confirmAdhesionTerms}
                style={[
                  styles.adhesionConfirm,
                  {
                    backgroundColor: termsAccepted ? theme.primary : theme.surfaceSubtle,
                    opacity: termsAccepted ? 1 : 0.65,
                  },
                ]}
              >
                {openingCheckoutPlanId !== null ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.adhesionConfirmText,
                      { color: termsAccepted ? theme.onPrimary : theme.textMuted },
                    ]}
                  >
                    Aceitar e continuar para o checkout
                  </Text>
                )}
              </MotionPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({
  title,
  theme,
}: {
  title: string;
  theme: ResolvedAppTheme;
}) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
  );
}
function ProgressBar({
  value,
  color,
  compact = false,
}: {
  value: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.progressTrack, compact && styles.compactProgressTrack]}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: color, width: `${value}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[12] },
  plansContent: {
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  plansIntro: {
    fontSize: typography.role.screenDescription.fontSize,
    lineHeight: typography.role.screenDescription.lineHeight,
    marginBottom: spacing[1],
    marginHorizontal: 2,
  },
  plansList: { gap: spacing[3] },
  planOption: {
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  planOptionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
  },
  planOptionCopy: { flex: 1, gap: spacing[1] },
  planName: {
    ...typography.role.sectionTitle,
  },
  planDescription: { ...typography.role.caption },
  planBadges: { alignItems: "flex-end", gap: spacing[1], maxWidth: "52%" },
  planBadge: {
    borderRadius: radius.pill,
    ...typography.role.label,
    letterSpacing: 0.3,
    overflow: "hidden",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    textTransform: "uppercase",
  },
  planPriceRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  planPrice: {
    fontSize: typography.size["2xl"],
    fontWeight: typography.weight.extrabold,
    lineHeight: 29,
  },
  planPeriod: { fontSize: typography.size.xs },
  planOptionFeatures: { gap: spacing[2] },
  planFeatureRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing[2] },
  planFeatureText: { flex: 1, fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight },
  planCta: {
    alignItems: "center",
    borderRadius: radius.button,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing[3],
  },
  planCtaText: { ...typography.role.button },
  plansValueNote: { ...typography.role.caption, marginHorizontal: 2 },
  plansTerms: { ...typography.role.caption, marginHorizontal: 3, marginTop: spacing[1], textAlign: "center" },
  adhesionBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(10, 12, 24, 0.62)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
  },
  adhesionDialog: {
    borderRadius: radius.dialog,
    borderWidth: 1,
    maxHeight: "90%",
    overflow: "hidden",
    width: "100%",
  },
  adhesionHeading: {
    alignItems: "center",
    borderBottomColor: palette.slate[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  adhesionHeadingCopy: { flex: 1, gap: spacing[1] },
  adhesionTitle: { ...typography.role.sectionTitle },
  adhesionVersion: { ...typography.role.caption, fontWeight: typography.weight.medium },
  adhesionClose: { alignItems: "center", borderRadius: radius.button, height: 44, justifyContent: "center", width: 44 },
  adhesionBody: { flexGrow: 0, flexShrink: 1 },
  adhesionBodyContent: { gap: spacing[3], padding: spacing[5] },
  adhesionSelectedPlan: { borderRadius: radius.md, gap: 2, padding: spacing[3] },
  adhesionOverline: { ...typography.role.label, letterSpacing: 0.6, textTransform: "uppercase" },
  adhesionSelectedPlanName: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  adhesionSectionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  adhesionCopy: { fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight },
  adhesionLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
  },
  adhesionLinkText: { ...typography.role.link },
  adhesionHint: { ...typography.role.caption },
  adhesionConsent: { alignItems: "flex-start", flexDirection: "row", gap: spacing[3], minHeight: 44, paddingVertical: spacing[2] },
  adhesionCheckbox: {
    alignItems: "center",
    borderRadius: 5,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22,
  },
  adhesionConsentText: { flex: 1, fontSize: typography.role.bodyStrong.fontSize, fontWeight: typography.weight.medium, lineHeight: typography.role.bodyStrong.lineHeight },
  adhesionActions: { borderTopColor: palette.slate[200], borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[2], padding: spacing[4] },
  adhesionCancel: { alignItems: "center", borderRadius: radius.button, borderWidth: borders.subtle, justifyContent: "center", minHeight: 46 },
  adhesionCancelText: { ...typography.role.button },
  adhesionConfirm: { alignItems: "center", borderRadius: radius.button, justifyContent: "center", minHeight: 46, paddingHorizontal: spacing[3] },
  adhesionConfirmText: { ...typography.role.button, textAlign: "center" },
  gradientHeader: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[10],
  },
  headerRow: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  headerBack: { padding: spacing[1] },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  headerSubtitle: { fontSize: typography.size.sm },
  currentCard: {
    borderRadius: radius.md,
    elevation: 3,
    gap: spacing[3],
    padding: spacing[5],
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  overline: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  caption: { fontSize: typography.size.xs, lineHeight: 17 },
  alignRight: { alignItems: "flex-end" },
  percent: {
    fontSize: typography.size["2xl"],
    fontWeight: typography.weight.bold,
  },
  progressTrack: {
    backgroundColor: "#E2E8F0",
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden",
  },
  compactProgressTrack: { height: 5, marginTop: spacing[2] },
  progressFill: { borderRadius: radius.pill, height: "100%" },
  primaryButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[4],
  },
  primaryButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  list: { gap: spacing[2] },
  moduleRow: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  currentBorder: { borderWidth: 2 },
  moduleNumber: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  moduleNumberText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  flex: { flex: 1, gap: 2 },
  moduleTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  miniTrack: {
    borderRadius: radius.pill,
    flex: 1,
    height: 5,
    overflow: "hidden",
  },
  miniProgress: { borderRadius: radius.pill, height: "100%" },
  tiny: { fontSize: 10 },
  trackCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  trackIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  alertCard: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  alertIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  segment: { borderRadius: radius.md, flexDirection: "row", padding: 4 },
  segmentButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: spacing[2],
  },
  segmentText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  errorRow: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  errorIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  errorCount: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  errorQuestion: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  periods: {
    backgroundColor: "#FFFFFF22",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 4,
    marginHorizontal: spacing[5],
    marginTop: -spacing[5],
    padding: 4,
    position: "relative",
    zIndex: 2,
  },
  period: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    paddingVertical: spacing[2],
  },
  podium: {
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    paddingTop: spacing[5],
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  podiumPerson: { alignItems: "center", flex: 1 },
  avatar: {
    alignItems: "center",
    borderRadius: 40,
    borderWidth: 2,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[2],
    textAlign: "center",
  },
  podiumBase: {
    alignItems: "center",
    alignSelf: "stretch",
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    gap: 2,
    marginTop: spacing[2],
    paddingVertical: spacing[3],
  },
  userList: { borderRadius: radius.md, overflow: "hidden" },
  userRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3],
  },
  rankNumber: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    width: 28,
  },
  smallAvatar: {
    alignItems: "center",
    borderRadius: 20,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  smallAvatarText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  score: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  myPosition: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3],
  },
  featuresCard: { borderRadius: radius.md, padding: spacing[5] },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    marginTop: spacing[4],
  },
  feature: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[2],
    width: "46%",
  },
  featureIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  featureText: {
    flex: 1,
    fontSize: 11,
    fontWeight: typography.weight.medium,
    lineHeight: 15,
    paddingTop: 6,
  },
  billingCycleRow: {
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[1],
    padding: spacing[1],
  },
  billingCycleButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing[2],
  },
  billingCycleLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  planCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[5],
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    marginBottom: 6,
    overflow: "hidden",
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  guarantee: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  faq: { borderRadius: radius.md, gap: spacing[2], padding: spacing[4] },
  loadingCard: {
    alignItems: "center",
    borderRadius: radius.md,
    gap: spacing[2],
    padding: spacing[5],
  },
  emptyPlanCard: {
    alignItems: "center",
    borderRadius: radius.md,
    gap: spacing[2],
    padding: spacing[5],
    textAlign: "center",
  },
  planFeature: { fontSize: 10, lineHeight: 15, marginTop: spacing[1] },
});
