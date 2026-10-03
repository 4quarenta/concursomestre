import React from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Linking,
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
import { useIAP, type Purchase, type ProductSubscription } from "expo-iap";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { MotionPressable } from "@/components/ui/Primitives";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { borders, palette, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useAuth } from "@/providers/AuthProvider";
import { CHECKOUT_ADHESION_TERMS_VERSION } from "@/services/legal/legalDocumentVersion";
import { planService } from "@/services/plans/planService";
import { isStoreDistributionChannel } from "@/config/runtime";
import {
  acknowledgeVerifiedGooglePlayPurchase,
  resolveGooglePlayPlanSelection,
  verifyGooglePlayPurchase,
} from "@/services/subscriptions/googlePlayBillingService";
import { useAccountTransactionsQuery } from "@/features/account/api/useAccountTransactionsQuery";
import { getPublicPlanBenefits } from "@/services/plans/publicPlanBenefits";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
import { PUBLIC_LINKS } from "@/config/publicLinks";
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
import type { MobilePlanName } from "@/types/system";
import type { MobileTransaction } from "@/types/transactions";
import { formatPlanPrice, roundPlanPriceUp } from "@shared/planPricing";

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
  if (
    plan.interval_unit === "year" ||
    (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 12)
  ) return "ano";
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

type PlanBillingCycle = "monthly" | "quarterly" | "annual";
type PlanRestriction = "tier" | "cycle" | "same-tier" | "cycle-unknown";

const PLAN_BILLING_CYCLES: Array<{
  key: PlanBillingCycle;
  label: string;
}> = [
  { key: "monthly", label: "Mensal" },
  { key: "quarterly", label: "Trimestral" },
  { key: "annual", label: "Anual" },
];

const getPlanBillingCycle = (plan: {
  interval_unit?: string;
  interval_count?: number;
}): PlanBillingCycle | null => {
  if (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 1) {
    return "monthly";
  }
  if (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 3) {
    return "quarterly";
  }
  if (
    plan.interval_unit === "year" ||
    (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 12)
  ) return "annual";
  return null;
};

const getPlanTierRank = (planName: string): number => {
  const canonicalName = resolveCanonicalPlanKey(planName);
  if (canonicalName === "Elite") return 3;
  if (canonicalName === "Pro") return 2;
  if (canonicalName === "Essencial") return 1;
  return 0;
};

const getPlanDurationRank = (plan: {
  interval_unit?: string;
  interval_count?: number;
}): number => {
  if (
    plan.interval_unit === "year" ||
    (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 12)
  ) {
    return 12 * Math.max(1, Number(plan.interval_count || 1));
  }
  if (plan.interval_unit === "month") {
    return Math.max(1, Number(plan.interval_count || 1));
  }
  if (plan.interval_unit === "day" || plan.interval_unit === "week") return 1;
  return 0;
};

const roundPlanCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const formatPlanAmount = formatPlanPrice;

const formatGooglePlayAmount = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(roundPlanPriceUp(amount));
  } catch {
    return `${currency} ${roundPlanPriceUp(amount).toFixed(2)}`;
  }
};

const parseSubscriptionDate = (raw?: string | number | null): Date | null => {
  if (raw === undefined || raw === null || raw === "") return null;
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
    : new Date(String(raw).trim().replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatSubscriptionDate = (raw?: string | number | null): string =>
  parseSubscriptionDate(raw)?.toLocaleDateString("pt-BR") || "Não informada";

const getDaysUntil = (raw?: string | number | null): number | null => {
  const date = parseSubscriptionDate(raw);
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
};

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
  const pendingGooglePlayPlanRef = React.useRef<Plan | null>(null);
  const purchaseCallbackRef = React.useRef<(purchase: Purchase) => Promise<void>>(
    async () => undefined,
  );
  const recoveryAttemptsRef = React.useRef(new Set<string>());
  const playBilling = useIAP({
    onPurchaseSuccess: (purchase) => {
      void purchaseCallbackRef.current(purchase).catch((error) => {
        Alert.alert(
          "Google Play",
          error instanceof Error
            ? error.message
            : "Não foi possível validar a compra. O acesso não será liberado até a confirmação do servidor.",
        );
      });
    },
    onPurchaseError: (error) => {
      const code = String(error.code || "").toLowerCase();
      if (code.includes("cancel")) return;
      Alert.alert(
        "Google Play",
        error.message || "Não foi possível concluir a compra. Tente novamente.",
      );
    },
  });
  const transactionsQuery = useAccountTransactionsQuery(Boolean(user?.id));
  const [plansData, setPlansData] = React.useState<Plan[]>([]);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    React.useState<PlanBillingCycle | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [openingCheckoutPlanId, setOpeningCheckoutPlanId] =
    React.useState<number | null>(null);
  const [termsPlan, setTermsPlan] = React.useState<Plan | null>(null);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [showAdhesionTerms, setShowAdhesionTerms] = React.useState(false);
  const [showManageSubscription, setShowManageSubscription] = React.useState(false);
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
  const googlePlayProductIds = React.useMemo(
    () => Array.from(new Set(
      plansData
        .filter((plan) => plan.google_play_billing_enabled === true)
        .map((plan) => String(plan.google_play_product_id || "").trim())
        .filter(Boolean),
    )),
    [plansData],
  );
  React.useEffect(() => {
    if (!isStoreDistributionChannel || !playBilling.connected || googlePlayProductIds.length === 0) return;
    void playBilling.fetchProducts({ skus: googlePlayProductIds, type: "subs" });
  }, [googlePlayProductIds, playBilling.connected]);
  const googlePlaySubscriptions: ProductSubscription[] = playBilling.subscriptions;
  purchaseCallbackRef.current = async (purchase) => {
    if (purchase.purchaseState === "pending") {
      Alert.alert(
        "Pagamento pendente",
        "A Google Play ainda está processando o pagamento. O plano será liberado após a confirmação.",
      );
      return;
    }
    if (purchase.purchaseState !== "purchased") return;

    const selectedPlan = pendingGooglePlayPlanRef.current || plansData.find(
      (plan) => plan.google_play_product_id === purchase.productId,
    );
    if (!selectedPlan) {
      throw new Error("Não foi possível associar esta compra a um plano ConcursoMestre.");
    }

    await verifyGooglePlayPurchase(selectedPlan, purchase);
    await acknowledgeVerifiedGooglePlayPurchase(purchase);
    pendingGooglePlayPlanRef.current = null;
    await refreshProfile();
    Alert.alert("Assinatura ativada", "A Google Play confirmou seu plano.");
  };
  React.useEffect(() => {
    if (!isStoreDistributionChannel || !playBilling.connected) return;
    void playBilling.getAvailablePurchases();
  }, [playBilling.connected]);
  React.useEffect(() => {
    if (!isStoreDistributionChannel) return;
    for (const purchase of playBilling.availablePurchases) {
      if (purchase.purchaseState !== "purchased") continue;
      const plan = plansData.find(
        (candidate) => candidate.google_play_product_id === purchase.productId,
      );
      if (!plan || recoveryAttemptsRef.current.has(purchase.id)) continue;
      recoveryAttemptsRef.current.add(purchase.id);
      void purchaseCallbackRef.current(purchase).catch((error) => {
        Alert.alert(
          "Google Play",
          error instanceof Error
            ? error.message
            : "Não foi possível recuperar a confirmação desta compra.",
        );
      });
    }
  }, [plansData, playBilling.availablePurchases]);
  const availableBillingCycles = React.useMemo(
    () =>
      PLAN_BILLING_CYCLES.filter(({ key }) =>
        plansData.some(
          (plan) =>
            plan.is_test_plan !== true &&
            Number(plan.price || 0) > 0 &&
            getPlanBillingCycle(plan) === key,
        ),
      ),
    [plansData],
  );
  React.useEffect(() => {
    if (availableBillingCycles.length === 0) return;
    if (
      selectedBillingCycle &&
      availableBillingCycles.some(({ key }) => key === selectedBillingCycle)
    ) {
      return;
    }

    const subscribedPlanId = user?.subscription?.plan_id ?? user?.subscription?.plan?.id;
    const subscribedPlan = subscribedPlanId == null
      ? undefined
      : plansData.find((plan) => String(plan.id) === String(subscribedPlanId));
    const subscribedCycle = subscribedPlan
      ? getPlanBillingCycle(subscribedPlan)
      : null;
    const preferredCycle = availableBillingCycles.some(
      ({ key }) => key === subscribedCycle,
    )
      ? subscribedCycle
      : availableBillingCycles[0].key;
    setSelectedBillingCycle(preferredCycle);
  }, [availableBillingCycles, plansData, selectedBillingCycle, user]);
  const activeBillingCycle =
    selectedBillingCycle ?? availableBillingCycles[0]?.key ?? "monthly";
  const adhesionPlanVariants = React.useMemo(() => {
    if (!termsPlan) return [];

    const canonicalName = resolveCanonicalPlanKey(termsPlan.name);
    const variants = plansData
      .filter((plan) =>
        resolveCanonicalPlanKey(plan.name) === canonicalName &&
        plan.is_active !== false &&
        plan.is_test_plan !== true &&
        Number(plan.price || 0) > 0 &&
        isPlanEnabledByName(plan.name, systemSettings.planDetails),
      )
      .sort((left, right) => {
        const leftCycle = getPlanBillingCycle(left);
        const rightCycle = getPlanBillingCycle(right);
        const order: Record<string, number> = { monthly: 0, quarterly: 1, annual: 2 };
        return (order[leftCycle || ""] ?? 3) - (order[rightCycle || ""] ?? 3) ||
          getPlanDurationRank(left) - getPlanDurationRank(right);
      });

    // Mantém uma opção por modalidade. Se houver ciclos personalizados,
    // cada duração distinta continua visível no termo.
    const uniqueVariants = new Map<string, Plan>();
    for (const plan of variants) {
      const cycle = getPlanBillingCycle(plan);
      const key = cycle || `${plan.interval_unit}-${Number(plan.interval_count || 1)}`;
      if (!uniqueVariants.has(key) || plan.id === termsPlan.id) {
        uniqueVariants.set(key, plan);
      }
    }
    if (!uniqueVariants.has(
      getPlanBillingCycle(termsPlan) ||
      `${termsPlan.interval_unit}-${Number(termsPlan.interval_count || 1)}`,
    )) {
      uniqueVariants.set(
        getPlanBillingCycle(termsPlan) ||
          `${termsPlan.interval_unit}-${Number(termsPlan.interval_count || 1)}`,
        termsPlan,
      );
    }
    return Array.from(uniqueVariants.values());
  }, [plansData, systemSettings.planDetails, termsPlan]);
  const visiblePlans = React.useMemo(() => {
    const plansByTier = new Map<string, Plan[]>();

    plansData
      .filter((plan) => plan.is_test_plan !== true)
      .filter((plan) => {
        const isFreePlan =
          resolveCanonicalPlanKey(plan.name) === "Gratuito" &&
          Number(plan.price || 0) <= 0;
        const isShortCycle = plan.interval_unit === "day" || plan.interval_unit === "week";
        return isFreePlan || (
          isShortCycle
            ? activeBillingCycle === "monthly"
            : getPlanBillingCycle(plan) === activeBillingCycle
        );
      })
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
        return [...variants].sort(
          (left, right) => Number(left.price || 0) - Number(right.price || 0),
        )[0];
      });
  }, [activeBillingCycle, plansData]);

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
      const subscriptionCycle =
        (subscription?.plan ? getPlanBillingCycle(subscription.plan) : null) ||
        user.billing?.billingCycle;
      const normalizedSubscriptionCycle =
        subscriptionCycle === "monthly" ||
        subscriptionCycle === "quarterly" ||
        subscriptionCycle === "annual"
          ? subscriptionCycle
          : null;
      return visiblePlans.find(
        (plan) =>
          resolveCanonicalPlanKey(plan.name) === subscribedPlanKey &&
          (!normalizedSubscriptionCycle ||
            getPlanBillingCycle(plan) === normalizedSubscriptionCycle),
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

  const currentSubscription = user?.subscription;
  const currentSubscriptionStatus = String(currentSubscription?.status || "")
    .trim()
    .toLowerCase();
  const hasActiveSubscription = ["active", "trialing", "past_due"].includes(
    currentSubscriptionStatus,
  );
  const paymentProvider = String(currentSubscription?.payment_provider || "")
    .trim()
    .toLowerCase();
  const isStripeSubscription = paymentProvider === "stripe";
  const renewalEnabled = currentSubscription?.cancel_at_period_end === true
    ? false
    : currentSubscription?.auto_renew !== false;
  const periodEndDate = currentSubscription?.current_period_end ||
    currentSubscription?.provider_current_period_end;
  const cycleDaysRemaining = getDaysUntil(periodEndDate);
  const planTransactions = transactionsQuery.data || [];
  const firstPaidPlanTransactionAt = React.useMemo(() => {
    const eligibleTransactions = (planTransactions as MobileTransaction[])
      .filter((transaction) =>
        String(transaction.type || "").toLowerCase() === "plan" &&
        Number(transaction.amount || 0) > 0 &&
        ["approved", "completed", "refund_requested", "refunded"].includes(
          String(transaction.status || "").toLowerCase(),
        ),
      )
      .map((transaction) => parseSubscriptionDate(
        transaction.createdAt ||
        (transaction as MobileTransaction & { created_at?: string }).created_at ||
        transaction.dueDate,
      ))
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => left.getTime() - right.getTime());
    return eligibleTransactions[0] || null;
  }, [planTransactions]);
  const daysSinceFirstPaidPlan = firstPaidPlanTransactionAt
    ? Math.max(0, Math.floor((Date.now() - firstPaidPlanTransactionAt.getTime()) / 86_400_000))
    : null;
  const refundWindowOpen = transactionsQuery.isSuccess &&
    Number(currentSubscription?.paid_installments || 0) <= 1 &&
    daysSinceFirstPaidPlan !== null &&
    daysSinceFirstPaidPlan < 7;
  const refundWindowDaysRemaining = refundWindowOpen && daysSinceFirstPaidPlan !== null
    ? Math.max(1, 7 - daysSinceFirstPaidPlan)
    : 0;
  const hasPendingRefundRequest = (planTransactions as MobileTransaction[]).some(
    (transaction) => String(transaction.status || "").toLowerCase() === "refund_requested",
  );

  const getPlanRestriction = (
    targetPlan: Plan,
  ): PlanRestriction | null => {
    const subscription = user?.subscription;
    const status = String(subscription?.status || "").trim().toLowerCase();
    if (!["active", "trialing", "past_due"].includes(status)) return null;

    const currentPlanIdFromSubscription = subscription?.plan_id ?? subscription?.plan?.id;
    const currentPlan = currentPlanIdFromSubscription == null
      ? undefined
      : plansData.find(
          (candidate) => String(candidate.id) === String(currentPlanIdFromSubscription),
        );
    const currentPlanName = subscription?.plan?.name || currentPlan?.name || user?.plan || "";
    const currentTier = getPlanTierRank(currentPlanName);
    const targetTier = getPlanTierRank(targetPlan.name);

    const activeSubscribedPlanId = currentPlanIdFromSubscription ?? currentPlan?.id;

    if (targetTier < currentTier) return "tier";
    if (
      targetTier !== currentTier ||
      String(targetPlan.id) === String(activeSubscribedPlanId ?? currentPlanId ?? "")
    ) return null;

    const currentDuration = currentPlan
      ? getPlanDurationRank(currentPlan)
      : subscription?.plan?.interval_unit
        ? getPlanDurationRank(subscription.plan)
        : user?.billing?.billingCycle === "annual"
          ? 12
          : user?.billing?.billingCycle === "quarterly"
            ? 3
            : user?.billing?.billingCycle === "monthly"
              ? 1
              : 0;
    if (currentDuration <= 0) return "cycle-unknown";
    if (currentDuration > 0 && getPlanDurationRank(targetPlan) < currentDuration) {
      return "cycle";
    }
    if (!systemSettings.sameTierCycleChangeEnabled) return "same-tier";
    return null;
  };

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

      if (isStoreDistributionChannel) {
        const storeSelection = resolveGooglePlayPlanSelection(
          plan,
          googlePlaySubscriptions,
        );
        if (!storeSelection) {
          throw new Error(
            "Este ciclo ainda não está configurado na Google Play Console. Nenhuma cobrança foi iniciada.",
          );
        }
        if (!playBilling.connected) {
          const reconnected = await playBilling.reconnect();
          if (!reconnected) throw new Error("Não foi possível conectar à Google Play.");
        }
        pendingGooglePlayPlanRef.current = plan;
        await playBilling.requestPurchase({
          request: {
            google: {
              skus: [storeSelection.productId],
              subscriptionOffers: [{
                sku: storeSelection.productId,
                offerToken: storeSelection.offerToken,
              }],
            },
          },
          type: "subs",
        });
        return;
      }

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
      pendingGooglePlayPlanRef.current = null;
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
    if (isStoreDistributionChannel && hasActiveSubscription) {
      Alert.alert(
        "Assinatura já ativa",
        paymentProvider === "stripe"
          ? "Sua assinatura foi contratada pela plataforma web. Para evitar cobranças duplicadas, gerencie ou encerre esse ciclo na web antes de contratar pela Google Play."
          : "Você já possui uma assinatura ativa. Gerencie ou encerre o ciclo atual na Google Play antes de contratar outro plano.",
      );
      return;
    }
    const restriction = getPlanRestriction(plan);
    if (restriction) {
      const message = restriction === "tier"
        ? "Você já possui um plano de nível superior ativo. Não é possível contratar um plano inferior enquanto essa assinatura estiver vigente."
        : restriction === "cycle"
          ? "Sua assinatura atual tem um ciclo maior. Não é possível mudar para um ciclo inferior enquanto ela estiver vigente."
          : restriction === "cycle-unknown"
            ? "Não foi possível confirmar o ciclo da sua assinatura atual. Atualize seu perfil ou fale com o suporte antes de alterar o plano."
            : "A troca de ciclo neste mesmo plano está desativada no momento.";
      Alert.alert("Alteração de plano indisponível", message);
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

  const closeManageSubscription = () => {
    setShowManageSubscription(false);
  };

  const openWebSubscriptionManagement = async () => {
    try {
      const safeUrl = assertAllowedExternalUrl(
        PUBLIC_LINKS.subscriptionManagement,
        "gerenciamento da assinatura",
      );
      if (!(await Linking.canOpenURL(safeUrl))) {
        throw new Error("Não foi possível abrir a área da assinatura neste aparelho.");
      }
      await Linking.openURL(safeUrl);
      setShowManageSubscription(false);
    } catch (error) {
      Alert.alert(
        "Assinatura",
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o gerenciamento da assinatura.",
      );
    }
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
        {!isLoading && !loadError && availableBillingCycles.length > 1 ? (
          <View
            style={[
              styles.billingCycleCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.billingCycleHeading}>
              <Text style={[styles.billingCycleTitle, { color: theme.text }]}>
                Ciclo de cobrança
              </Text>
              <Text style={[styles.billingCycleHint, { color: theme.textMuted }]}>
                Selecione uma opção disponível
              </Text>
            </View>
            <View
              style={[
                styles.billingCycleRow,
                { backgroundColor: theme.surfaceSubtle },
              ]}
            >
              {availableBillingCycles.map((cycle) => {
                const isSelected = activeBillingCycle === cycle.key;
                return (
                  <MotionPressable
                    key={cycle.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Ciclo de cobrança ${cycle.label.toLowerCase()}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedBillingCycle(cycle.key)}
                    style={[
                      styles.billingCycleButton,
                      isSelected && {
                        backgroundColor: theme.primarySubtle,
                        borderColor: theme.primary,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.billingCycleLabel,
                        { color: isSelected ? theme.primary : theme.textMuted },
                      ]}
                    >
                      {cycle.label}
                    </Text>
                  </MotionPressable>
                );
              })}
            </View>
          </View>
        ) : null}
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
            const isShortCycle = plan.interval_unit === "day" || plan.interval_unit === "week";
            const cycleCount = isShortCycle
              ? 1
              : plan.interval_unit === "year" ||
                  (plan.interval_unit === "month" && Number(plan.interval_count || 1) === 12)
                ? 12
                : plan.interval_unit === "month" && Number(plan.interval_count || 1) === 3
                  ? 3
                  : 1;
            const canonicalPricingKey = resolveCanonicalPlanKey(plan.name) as MobilePlanName | null;
            const monthlyVariant = plansData.find(
              (candidate) =>
                resolveCanonicalPlanKey(candidate.name) === canonicalName &&
                candidate.interval_unit === "month" &&
                Number(candidate.interval_count || 1) === 1 &&
                Number(candidate.price || 0) > 0,
            );
            const monthlyBaseAmount = canonicalPricingKey
              ? Number(systemSettings.pricing[canonicalPricingKey]?.monthly || monthlyVariant?.price || 0)
              : Number(monthlyVariant?.price || 0);
            const monthlyEquivalent = cycleCount > 1
              ? roundPlanPriceUp(cycleAmount / cycleCount)
              : cycleAmount;
            const undiscountedCycleAmount = monthlyBaseAmount * cycleCount;
            const savingsAmount = cycleCount > 1
              ? roundPlanCurrency(Math.max(0, undiscountedCycleAmount - cycleAmount))
              : 0;
            const discountPercent = undiscountedCycleAmount > 0
              ? Math.round((savingsAmount / undiscountedCycleAmount) * 100)
              : 0;
            const hasCycleDiscount = savingsAmount >= 0.01 && discountPercent > 0;
            const isElite = canonicalName === "Elite";
            const isMostChosen = plan.id === mostChosenPlanId;
            const isCurrent = currentPlanId === plan.id;
            const googlePlaySelection = isStoreDistributionChannel
              ? resolveGooglePlayPlanSelection(plan, googlePlaySubscriptions)
              : null;
            const storeProductUnavailable = isStoreDistributionChannel &&
              Number(plan.price || 0) > 0 && !googlePlaySelection;
            const restriction = getPlanRestriction(plan);
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
                <View style={styles.planPricingBlock}>
                  <View style={styles.planPriceRow}>
                    <Text style={[styles.planPrice, { color: theme.text }]}>
                      {isStoreDistributionChannel
                        ? googlePlaySelection?.amount !== null && googlePlaySelection?.amount !== undefined && cycleCount > 1 && googlePlaySelection.currency
                          ? formatGooglePlayAmount(googlePlaySelection.amount / cycleCount, googlePlaySelection.currency)
                          : googlePlaySelection?.localizedPrice || "Preço indisponível"
                        : formatPlanAmount(isShortCycle ? cycleAmount : monthlyEquivalent)}
                    </Text>
                    <Text style={[styles.planPeriod, { color: theme.textMuted }]}>
                      {Number(plan.price || 0) <= 0
                        ? "sem custo"
                        : isStoreDistributionChannel
                          ? googlePlaySelection?.amount !== null && googlePlaySelection?.amount !== undefined && cycleCount > 1
                            ? "/mês"
                            : ""
                    : isShortCycle
                      ? `/${getPlanCycleLabel(plan)}`
                      : "/mês"}
                    </Text>
                  </View>
                  {Number(plan.price || 0) > 0 ? (
                    <Text style={[styles.planTotal, { color: theme.textMuted }]}>
                      {isStoreDistributionChannel
                        ? googlePlaySelection?.localizedPrice
                          ? `Cobrança pela Google Play: ${googlePlaySelection.localizedPrice}`
                          : "Preço da Google Play ainda não configurado"
                        : cycleCount > 1
                        ? `Total de ${formatPlanAmount(cycleAmount)} ${cycleCount === 12 ? "por ano" : "a cada 3 meses"}`
                        : isShortCycle
                          ? `Cobrança por ${getPlanCycleLabel(plan)} de ${formatPlanAmount(cycleAmount)}`
                          : "Cobrado mensalmente"}
                    </Text>
                  ) : null}
                  {!isStoreDistributionChannel && hasCycleDiscount ? (
                    <View style={styles.planSavingsRow}>
                      <Ionicons name="pricetag" size={14} color={theme.success} />
                      <Text style={[styles.planSavingsText, { color: theme.success }]}>
                        Economize {formatPlanAmount(savingsAmount)} no ciclo
                      </Text>
                      <View
                        style={[
                          styles.planDiscountBadge,
                          { backgroundColor: theme.successSubtle, borderColor: theme.successBorder },
                        ]}
                      >
                        <Text style={[styles.planDiscountLabel, { color: theme.success }]}>
                          {discountPercent}% OFF
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {Number(plan.price || 0) > 0 ? (
                    <View
                      style={[
                        styles.refundGuaranteeBadge,
                        { backgroundColor: theme.successSubtle, borderColor: theme.successBorder },
                      ]}
                    >
                      <Ionicons name="shield-checkmark-outline" size={13} color={theme.success} />
                      <Text style={[styles.refundGuaranteeText, { color: theme.success }]}>
                        7 dias para solicitar reembolso
                      </Text>
                    </View>
                  ) : null}
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
                    disabled: Boolean(restriction) || storeProductUnavailable || openingCheckoutPlanId !== null || (isCurrent && !currentSubscription),
                  }}
                  accessibilityHint={restriction ? "Mudança de plano ou ciclo inferior não permitida." : undefined}
                  disabled={Boolean(restriction) || storeProductUnavailable || openingCheckoutPlanId !== null || (isCurrent && !currentSubscription)}
                  onPress={() => {
                    if (isCurrent) {
                      if (!currentSubscription) return;
                      setShowManageSubscription(true);
                      return;
                    }
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
                      backgroundColor: restriction
                        ? theme.surfaceSubtle
                        : isElite
                          ? isDarkTheme
                            ? "#E0BB68"
                            : "#E4BD68"
                          : isMostChosen
                            ? theme.primary
                            : isCurrent
                              ? theme.surfaceSubtle
                              : theme.surface,
                      borderColor: restriction
                        ? theme.border
                        : isElite
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
                          color: restriction
                            ? theme.textMuted
                            : isElite
                              ? "#2B210D"
                              : isMostChosen
                                ? theme.onPrimary
                                : isCurrent
                                  ? theme.textMuted
                                  : theme.text,
                        },
                      ]}
                    >
                      {storeProductUnavailable
                        ? "Indisponível na Google Play"
                        : isCurrent
                        ? currentSubscription ? "Gerenciar assinatura" : "Plano atual"
                        : restriction === "tier"
                          ? "Downgrade não permitido"
                          : restriction === "cycle"
                            ? "Ciclo inferior não permitido"
                          : restriction === "cycle-unknown"
                            ? "Ciclo atual não identificado"
                            : restriction === "same-tier"
                              ? "Troca de ciclo indisponível"
                              : isElite
                                ? "Explorar Elite"
                                : isMostChosen
                                  ? "Conhecer Pro"
                                  : canonicalName === "Gratuito"
                                    ? "Começar grátis"
                                    : "Conhecer " + canonicalName}
                    </Text>
                  )}
                  {!restriction && openingCheckoutPlanId !== plan.id ? (
                    <Ionicons
                      name={isCurrent ? "settings-outline" : isElite ? "open-outline" : "arrow-forward"}
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
          {isStoreDistributionChannel
            ? "Os preços de cobrança são fornecidos pela Google Play; os benefícios vêm do catálogo administrado do ConcursoMestre."
            : "Os valores e recursos acima são os publicados no catálogo da plataforma."}
        </Text>
        <Text style={[styles.plansTerms, { color: theme.textMuted }]}>
          Confira as condições, o ciclo de cobrança e a renovação antes de confirmar a assinatura.
        </Text>
      </ScrollView>
      <AnimatedModal
        mode="fade"
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
                  <Text style={[styles.adhesionCopy, { color: theme.textMuted }]}>
                    Escolha uma modalidade disponível para este plano:
                  </Text>
                  <View style={styles.adhesionVariants}>
                    {adhesionPlanVariants.map((variant) => {
                      const isSelected = variant.id === termsPlan.id;
                      const restriction = getPlanRestriction(variant);
                      const cycle = getPlanBillingCycle(variant);
                      const cycleCount = getPlanDurationRank(variant) || 1;
                      const playSelection = isStoreDistributionChannel
                        ? resolveGooglePlayPlanSelection(variant, googlePlaySubscriptions)
                        : null;
                      const isUnavailable = Boolean(restriction) ||
                        (isStoreDistributionChannel && Number(variant.price || 0) > 0 && !playSelection);
                      const cycleAmount =
                        variant.interval_unit === "day" || variant.interval_unit === "week"
                          ? Number(variant.price || 0)
                          : resolveConfiguredPlanCycleAmount(
                              variant,
                              systemSettings.pricing,
                            );
                      const monthlyEquivalent = cycleCount > 1
                        ? roundPlanPriceUp(cycleAmount / cycleCount)
                        : cycleAmount;
                      const canonicalKey = resolveCanonicalPlanKey(variant.name) as MobilePlanName | null;
                      const monthlyVariant = plansData.find((candidate) =>
                        resolveCanonicalPlanKey(candidate.name) === resolveCanonicalPlanKey(variant.name) &&
                        candidate.interval_unit === "month" &&
                        Number(candidate.interval_count || 1) === 1 &&
                        Number(candidate.price || 0) > 0,
                      );
                      const monthlyBase = canonicalKey
                        ? Number(systemSettings.pricing[canonicalKey]?.monthly || monthlyVariant?.price || 0)
                        : Number(monthlyVariant?.price || 0);
                      const referenceTotal = monthlyBase * cycleCount;
                      const savings = cycleCount > 1
                        ? roundPlanCurrency(Math.max(0, referenceTotal - cycleAmount))
                        : 0;
                      const cycleLabel = cycle
                        ? PLAN_BILLING_CYCLES.find((item) => item.key === cycle)?.label
                        : `A cada ${getPlanCycleLabel(variant)}`;
                      const restrictionText = restriction === "tier"
                        ? "Nível inferior ao plano atual"
                        : restriction === "cycle"
                          ? "Não é permitido reduzir o ciclo atual"
                          : restriction === "same-tier"
                            ? "Troca de ciclo indisponível"
                            : restriction === "cycle-unknown"
                              ? "Ciclo atual não confirmado"
                              : "";

                      return (
                        <MotionPressable
                          key={variant.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected, disabled: isUnavailable || openingCheckoutPlanId !== null }}
                          disabled={isUnavailable || openingCheckoutPlanId !== null}
                          onPress={() => {
                            if (isSelected || isUnavailable) return;
                            setTermsPlan(variant);
                            setTermsAccepted(false);
                          }}
                          style={[
                            styles.adhesionVariant,
                            {
                              backgroundColor: isSelected ? theme.primarySubtle : theme.surface,
                              borderColor: isSelected ? theme.primary : theme.border,
                              opacity: isUnavailable ? 0.55 : 1,
                            },
                          ]}
                        >
                          <View style={styles.adhesionVariantHeader}>
                            <Text style={[styles.adhesionVariantLabel, { color: theme.text }]}>
                              {cycleLabel}
                            </Text>
                            <Ionicons
                              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                              size={19}
                              color={isSelected ? theme.primary : theme.textMuted}
                            />
                          </View>
                          <Text style={[styles.adhesionVariantPrice, { color: theme.text }]}>
                            {isStoreDistributionChannel
                              ? playSelection?.amount !== null && playSelection?.amount !== undefined && cycleCount > 1 && playSelection.currency
                                ? formatGooglePlayAmount(playSelection.amount / cycleCount, playSelection.currency)
                                : playSelection?.localizedPrice || "Preço indisponível"
                              : formatPlanAmount(cycleCount > 1 ? monthlyEquivalent : cycleAmount)}
                            <Text style={[styles.adhesionVariantPeriod, { color: theme.textMuted }]}>
                              {isStoreDistributionChannel
                                ? playSelection?.amount !== null && playSelection?.amount !== undefined && cycleCount > 1
                                  ? "/mês"
                                  : ""
                                : cycleCount > 1 ? "/mês" : `/${getPlanCycleLabel(variant)}`}
                            </Text>
                          </Text>
                          <Text style={[styles.adhesionVariantTotal, { color: theme.textMuted }]}>
                            {isStoreDistributionChannel
                              ? playSelection?.localizedPrice
                                ? `Cobrança pela Google Play: ${playSelection.localizedPrice}`
                                : "Preço da Google Play ainda não configurado"
                              : cycleCount > 1
                              ? `Total ${formatPlanAmount(cycleAmount)} ${cycleCount === 12 ? "por ano" : "por trimestre"}`
                              : `Cobrança por ${getPlanCycleLabel(variant)}`}
                          </Text>
                          {!isStoreDistributionChannel && savings >= 0.01 ? (
                            <Text style={[styles.adhesionVariantSavings, { color: theme.success }]}>
                              Economia de {formatPlanAmount(savings)} no ciclo
                            </Text>
                          ) : null}
                          {restrictionText ? (
                            <Text style={[styles.adhesionVariantUnavailable, { color: theme.textMuted }]}>
                              {restrictionText}
                            </Text>
                          ) : null}
                        </MotionPressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View
                style={[
                  styles.adhesionTrustInfo,
                  { backgroundColor: theme.successSubtle, borderColor: theme.successBorder },
                ]}
              >
                <View style={styles.adhesionTrustRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={theme.success} />
                  <Text style={[styles.adhesionTrustTitle, { color: theme.success }]}>
                    7 dias para solicitar reembolso
                  </Text>
                </View>
                <Text style={[styles.adhesionTrustCopy, { color: theme.textMuted }]}>
                  Você pode solicitar o reembolso em até 7 dias após a compra, conforme as condições dos termos de adesão.
                </Text>
              </View>
              <View
                style={[
                  styles.adhesionTrustInfo,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
              >
                <View style={styles.adhesionTrustRow}>
                  <Ionicons name="lock-closed-outline" size={17} color={theme.primary} />
                  <Text style={[styles.adhesionTrustTitle, { color: theme.text }]}>
                    {isStoreDistributionChannel ? "Compra segura via Google Play" : "Compra segura via Stripe"}
                  </Text>
                </View>
                <Text style={[styles.adhesionTrustCopy, { color: theme.textMuted }]}>
                  {isStoreDistributionChannel
                    ? "O pagamento será confirmado pela Google Play. Os dados do cartão não são armazenados pelo aplicativo."
                    : "O pagamento será concluído no ambiente seguro da Stripe. Os dados do cartão não são armazenados pelo aplicativo."}
                </Text>
              </View>
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
      </AnimatedModal>
      <AnimatedModal
        mode="sheet"
        onRequestClose={closeManageSubscription}
        transparent
        visible={showManageSubscription}
      >
        <View style={styles.manageBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar gerenciamento da assinatura"
            onPress={closeManageSubscription}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.manageDialog,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
              },
            ]}
          >
            <View style={styles.manageHandle} />
            <View style={styles.adhesionHeading}>
              <View style={styles.adhesionHeadingCopy}>
                <Text style={[styles.adhesionTitle, { color: theme.text }]}>
                  Gerenciar assinatura
                </Text>
                <Text style={[styles.adhesionVersion, { color: theme.textMuted }]}>
                  {currentSubscription?.plan?.displayName ||
                    currentSubscription?.plan?.name || user?.plan || "Plano atual"}
                </Text>
              </View>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={closeManageSubscription}
                style={styles.adhesionClose}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </MotionPressable>
            </View>
            <ScrollView
              style={styles.manageBody}
              contentContainerStyle={styles.manageBodyContent}
              showsVerticalScrollIndicator
            >
              <View style={[styles.manageSummaryCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <View style={styles.manageSummaryRow}>
                  <View style={[styles.manageIcon, { backgroundColor: hasActiveSubscription ? theme.successSubtle : theme.warningSubtle }]}>
                    <Ionicons
                      name={hasActiveSubscription ? "checkmark-circle-outline" : "alert-circle-outline"}
                      size={19}
                      color={hasActiveSubscription ? theme.success : theme.warning}
                    />
                  </View>
                  <View style={styles.manageSummaryCopy}>
                    <Text style={[styles.manageLabel, { color: theme.textMuted }]}>Status da assinatura</Text>
                    <Text style={[styles.manageValue, { color: theme.text }]}>
                      {currentSubscriptionStatus === "active"
                        ? "Ativa"
                        : currentSubscriptionStatus === "trialing"
                          ? "Período de teste"
                          : currentSubscriptionStatus === "past_due"
                            ? "Pagamento em atraso"
                            : currentSubscriptionStatus || "Não confirmada"}
                    </Text>
                    <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                      Provedor: {paymentProvider === "stripe" ? "Stripe" : paymentProvider || "não informado"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.manageDivider, { backgroundColor: theme.border }]} />
                <View style={styles.manageSummaryRow}>
                  <View style={[styles.manageIcon, { backgroundColor: theme.primarySubtle }]}>
                    <Ionicons name="calendar-outline" size={19} color={theme.primary} />
                  </View>
                  <View style={styles.manageSummaryCopy}>
                    <Text style={[styles.manageLabel, { color: theme.textMuted }]}>Ciclo atual</Text>
                    <Text style={[styles.manageValue, { color: theme.text }]}>
                      {periodEndDate
                        ? `Termina em ${formatSubscriptionDate(periodEndDate)}`
                        : "Vigência ainda não confirmada"}
                    </Text>
                    {currentSubscription?.current_period_start ? (
                      <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                        Início do ciclo: {formatSubscriptionDate(currentSubscription.current_period_start)}
                      </Text>
                    ) : null}
                  </View>
                  {cycleDaysRemaining !== null ? (
                    <View style={[styles.manageDaysBadge, { backgroundColor: theme.primarySubtle }]}>
                      <Text style={[styles.manageDaysText, { color: theme.primary }]}>
                        {cycleDaysRemaining} {cycleDaysRemaining === 1 ? "dia" : "dias"}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.manageDivider, { backgroundColor: theme.border }]} />
                <View style={styles.manageSummaryRow}>
                  <View style={[styles.manageIcon, { backgroundColor: renewalEnabled ? theme.successSubtle : theme.warningSubtle }]}>
                    <Ionicons
                      name={renewalEnabled ? "refresh-outline" : "pause-circle-outline"}
                      size={19}
                      color={renewalEnabled ? theme.success : theme.warning}
                    />
                  </View>
                  <View style={styles.manageSummaryCopy}>
                    <Text style={[styles.manageLabel, { color: theme.textMuted }]}>Renovação automática</Text>
                    <Text style={[styles.manageValue, { color: theme.text }]}>
                      {renewalEnabled ? "Ativada" : "Desativada"}
                    </Text>
                  </View>
                </View>
                {renewalEnabled ? (
                  <View style={styles.manageRenewalDetails}>
                    {currentSubscription?.next_renewal_date || currentSubscription?.next_billing_at ? (
                      <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                        Próxima renovação: {formatSubscriptionDate(currentSubscription.next_renewal_date || currentSubscription.next_billing_at)}
                      </Text>
                    ) : null}
                    {Number(currentSubscription?.next_renewal_amount || 0) > 0 ? (
                      <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                        Valor previsto: {formatPlanAmount(Number(currentSubscription?.next_renewal_amount))}
                        {currentSubscription?.next_renewal_cycle_label
                          ? ` · ${currentSubscription.next_renewal_cycle_label}`
                          : ""}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                    Seu acesso permanece até o fim do período contratado, salvo pendências do termo.
                  </Text>
                )}
              </View>

              <View style={[styles.manageInfoCard, { backgroundColor: refundWindowOpen ? theme.successSubtle : theme.surface, borderColor: refundWindowOpen ? theme.successBorder : theme.border }]}>
                <View style={styles.manageInfoHeading}>
                  <Ionicons
                    name={hasPendingRefundRequest ? "time-outline" : refundWindowOpen ? "shield-checkmark-outline" : "information-circle-outline"}
                    size={18}
                    color={hasPendingRefundRequest ? theme.warning : refundWindowOpen ? theme.success : theme.textMuted}
                  />
                  <Text style={[styles.manageInfoTitle, { color: theme.text }]}>
                    {hasPendingRefundRequest
                      ? "Reembolso em análise"
                      : refundWindowOpen
                        ? `Janela inicial: ${refundWindowDaysRemaining} ${refundWindowDaysRemaining === 1 ? "dia restante" : "dias restantes"}`
                        : firstPaidPlanTransactionAt
                          ? "Janela inicial de 7 dias encerrada"
                          : "Prazo de reembolso não confirmado"}
                  </Text>
                </View>
                <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                  {hasPendingRefundRequest
                    ? "Já existe uma solicitação em análise. Consulte o andamento na plataforma web antes de enviar outra."
                    : refundWindowOpen
                      ? "Você está dentro do prazo inicial de reembolso. Para solicitar cancelamento ou reembolso, continue pelo gerenciamento da assinatura na plataforma web."
                      : firstPaidPlanTransactionAt
                        ? "Para cancelar ou alterar a renovação, use o gerenciamento da assinatura na plataforma web. As condições do ciclo contratado serão apresentadas lá antes da confirmação."
                        : transactionsQuery.isPending
                          ? "Consultando o histórico de compras para verificar a janela de reembolso."
                          : "Não foi possível confirmar o prazo pelo histórico carregado. A plataforma web apresentará a elegibilidade antes de receber uma solicitação."}
                </Text>
              </View>

              {isStripeSubscription ? (
                <View style={[styles.manageInfoCard, { backgroundColor: theme.primarySubtle, borderColor: theme.border }]}>
                  <View style={styles.manageInfoHeading}>
                    <Ionicons name="globe-outline" size={18} color={theme.primary} />
                    <Text style={[styles.manageInfoTitle, { color: theme.text }]}>Assinatura contratada na web</Text>
                  </View>
                  <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                    Cancelamento, renovação e solicitações de reembolso são gerenciados na sua conta do site. O app não altera essa assinatura.
                  </Text>
                </View>
              ) : null}

              {!isStripeSubscription ? (
                <View style={[styles.manageInfoCard, { backgroundColor: theme.warningSubtle, borderColor: theme.warningBorder }]}>
                  <View style={styles.manageInfoHeading}>
                    <Ionicons name="storefront-outline" size={18} color={theme.warning} />
                    <Text style={[styles.manageInfoTitle, { color: theme.text }]}>Gerenciamento pelo provedor</Text>
                  </View>
                  <Text style={[styles.manageDetail, { color: theme.textMuted }]}>
                    Esta assinatura não está identificada como Stripe. Até a integração de billing da loja ficar ativa, confira as opções de gerenciamento na plataforma web.
                  </Text>
                </View>
              ) : null}

            </ScrollView>
            <View style={[styles.manageActions, { borderTopColor: theme.border }]}>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => void openWebSubscriptionManagement()}
                style={[styles.manageWebButton, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="open-outline" size={18} color={theme.onPrimary} />
                <Text style={styles.manageCancelText}>Gerenciar assinatura na web</Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                onPress={closeManageSubscription}
                style={[styles.adhesionCancel, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.adhesionCancelText, { color: theme.text }]}>Fechar</Text>
              </MotionPressable>
            </View>
          </View>
        </View>
      </AnimatedModal>
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
  billingCycleCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[3],
  },
  billingCycleHeading: { gap: 2, paddingHorizontal: 2 },
  billingCycleTitle: {
    fontSize: typography.role.bodyStrong.fontSize,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.role.bodyStrong.lineHeight,
  },
  billingCycleHint: { ...typography.role.caption },
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
  },
  planPricingBlock: { gap: spacing[1] },
  planTotal: {
    fontSize: typography.role.caption.fontSize,
    lineHeight: typography.role.caption.lineHeight,
  },
  planSavingsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[1],
    marginTop: spacing[1],
  },
  planSavingsText: {
    flexShrink: 1,
    fontSize: typography.role.label.fontSize,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.role.label.lineHeight,
  },
  planDiscountBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    marginLeft: "auto",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  planDiscountLabel: {
    fontSize: 10,
    fontWeight: typography.weight.extrabold,
    lineHeight: 13,
  },
  refundGuaranteeBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  refundGuaranteeText: {
    fontSize: typography.role.label.fontSize,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.role.label.lineHeight,
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
  adhesionVariants: { gap: spacing[2], marginTop: spacing[2] },
  adhesionVariant: { borderRadius: radius.md, borderWidth: 1, gap: spacing[1], padding: spacing[3] },
  adhesionVariantHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  adhesionVariantLabel: { ...typography.role.label, fontWeight: typography.weight.semibold },
  adhesionVariantPrice: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
  adhesionVariantPeriod: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  adhesionVariantTotal: { ...typography.role.caption },
  adhesionVariantSavings: { ...typography.role.caption, fontWeight: typography.weight.semibold },
  adhesionVariantUnavailable: { ...typography.role.caption, fontWeight: typography.weight.medium },
  adhesionTrustInfo: { borderRadius: radius.md, borderWidth: borders.subtle, gap: spacing[2], padding: spacing[3] },
  adhesionTrustRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  adhesionTrustTitle: { ...typography.role.label, fontWeight: typography.weight.semibold },
  adhesionTrustCopy: { ...typography.role.caption, lineHeight: typography.role.body.lineHeight },
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
  manageBackdrop: {
    backgroundColor: "rgba(10, 12, 24, 0.62)",
    flex: 1,
    justifyContent: "flex-end",
    paddingTop: spacing[8],
  },
  manageDialog: {
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    borderWidth: 1,
    borderBottomWidth: 0,
    height: "90%",
    maxHeight: "92%",
    overflow: "hidden",
    width: "100%",
  },
  manageHandle: { alignSelf: "center", backgroundColor: palette.slate[400], borderRadius: radius.pill, height: 4, marginTop: spacing[3], marginBottom: spacing[2], width: 40 },
  manageBody: { flexGrow: 0, flexShrink: 1 },
  manageBodyContent: { gap: spacing[3], padding: spacing[4] },
  manageSummaryCard: { borderRadius: radius.md, borderWidth: borders.subtle, gap: spacing[3], padding: spacing[3] },
  manageSummaryRow: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  manageIcon: { alignItems: "center", borderRadius: radius.sm, height: 38, justifyContent: "center", width: 38 },
  manageSummaryCopy: { flex: 1, gap: 2, minWidth: 0 },
  manageLabel: { ...typography.role.caption, fontWeight: typography.weight.semibold },
  manageValue: { ...typography.role.bodyStrong },
  manageDaysBadge: { borderRadius: radius.pill, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  manageDaysText: { ...typography.role.label, fontWeight: typography.weight.bold },
  manageDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing[1] },
  manageRenewalDetails: { gap: spacing[1], paddingLeft: 38 + spacing[3] },
  manageDetail: { ...typography.role.caption, lineHeight: typography.role.body.lineHeight },
  manageInfoCard: { borderRadius: radius.md, borderWidth: borders.subtle, gap: spacing[2], padding: spacing[3] },
  manageInfoHeading: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  manageInfoTitle: { ...typography.role.label, flex: 1, fontWeight: typography.weight.semibold },
  manageActions: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[2], padding: spacing[4] },
  manageWebButton: { alignItems: "center", borderRadius: radius.button, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3] },
  manageCancelText: { ...typography.role.button, color: "#FFFFFF", textAlign: "center" },
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
