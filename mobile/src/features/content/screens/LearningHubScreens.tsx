import React from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useAuth } from "@/providers/AuthProvider";
import { CHECKOUT_ADHESION_TERMS_VERSION } from "@/services/legal/legalDocumentVersion";
import { planService } from "@/services/plans/planService";
import {
  getMissingCheckoutProfileFields,
} from "@/services/plans/checkoutRequirements";
import {
  isPlanEnabledByName,
  resolveCanonicalPlanKey,
  resolveConfiguredPlanCycleAmount,
  resolveConfiguredPlanDisplayName,
} from "@/services/plans/planDetails";
import {
  homeTestimonialsService,
  resolveHomeTestimonials,
  resolveTestimonialPhotoUrl,
  type HomeTestimonial,
} from "@/services/marketing/homeTestimonials";
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

const errorsBySubject = [
  { subject: "Direito Const.", count: 18, lastError: "há 2 dias" },
  { subject: "Matemática", count: 12, lastError: "ontem" },
  { subject: "Português", count: 8, lastError: "há 4 dias" },
  { subject: "Direito Admin.", count: 6, lastError: "há 1 semana" },
];

const recentErrors = [
  {
    id: 1,
    subject: "Direito Const.",
    topic: "Direitos Fundamentais",
    banca: "CESPE",
    year: 2023,
    attempts: 2,
    daysAgo: 2,
  },
  {
    id: 2,
    subject: "Matemática",
    topic: "Probabilidade",
    banca: "FCC",
    year: 2023,
    attempts: 1,
    daysAgo: 1,
  },
  {
    id: 3,
    subject: "Português",
    topic: "Concordância Verbal",
    banca: "FGV",
    year: 2024,
    attempts: 3,
    daysAgo: 4,
  },
  {
    id: 4,
    subject: "Direito Const.",
    topic: "Organização do Estado",
    banca: "CESPE",
    year: 2022,
    attempts: 1,
    daysAgo: 5,
  },
];

const topUsers = [
  { rank: 1, name: "João Pedro", score: 4820, streak: 45, avatar: "J" },
  { rank: 2, name: "Mariana C.", score: 4650, streak: 38, avatar: "M" },
  { rank: 3, name: "Lucas Souza", score: 4420, streak: 30, avatar: "L" },
];
const otherUsers = [
  { rank: 4, name: "Ana Beatriz", score: 4180, streak: 28, avatar: "A" },
  { rank: 5, name: "Roberto S.", score: 3950, streak: 22, avatar: "R" },
  { rank: 6, name: "Carla M.", score: 3820, streak: 19, avatar: "C" },
  { rank: 7, name: "Felipe Lima", score: 3640, streak: 17, avatar: "F" },
  { rank: 8, name: "Beatriz N.", score: 3420, streak: 15, avatar: "B" },
  { rank: 9, name: "Diego A.", score: 3210, streak: 12, avatar: "D" },
  { rank: 10, name: "Sofia P.", score: 3050, streak: 10, avatar: "S" },
];

const premiumFeatures = [
  ["infinite", "Questões ilimitadas"],
  ["chatbubble", "Comentários completos do professor"],
  ["bar-chart", "Análise avançada por IA"],
  ["book", "Trilhas de estudo personalizadas"],
  ["flash", "Simulados ilimitados"],
  ["gift", "Sem anúncios"],
] as const;
const iconFor = (name: string): keyof typeof Ionicons.glyphMap =>
  (({
    flame: "flame",
    book: "book-outline",
    target: "locate-outline",
    trophy: "trophy-outline",
    flash: "flash-outline",
    ribbon: "ribbon-outline",
    star: "star",
    medal: "medal-outline",
    "trending-up": "trending-up-outline",
    time: "time-outline",
    infinite: "infinite-outline",
    chatbubble: "chatbubble-ellipses-outline",
    "bar-chart": "bar-chart-outline",
    gift: "gift-outline",
  })[name] as keyof typeof Ionicons.glyphMap) || "ellipse-outline";

const getPlanCycleCount = (plan: Plan) =>
  plan.interval_unit === "year"
    ? 12
    : plan.interval_unit === "month"
      ? Math.max(1, Number(plan.interval_count || 1))
      : 1;

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

type PlanBillingCycle = "monthly" | "quarterly" | "annual";

const PLAN_BILLING_CYCLES: Array<{ key: PlanBillingCycle; label: string }> = [
  { key: "monthly", label: "Mensal" },
  { key: "quarterly", label: "Trimestral" },
  { key: "annual", label: "Anual" },
];

const matchesPlanBillingCycle = (plan: Plan, cycle: PlanBillingCycle) => {
  if (plan.interval_unit === "day" || plan.interval_unit === "week") {
    return false;
  }
  if (cycle === "annual") return plan.interval_unit === "year";
  if (cycle === "quarterly") {
    return (
      plan.interval_unit === "month" && Number(plan.interval_count || 1) === 3
    );
  }
  return (
    plan.interval_unit === "month" && Number(plan.interval_count || 1) === 1
  );
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

export function ReviewErrorsScreen() {
  const theme = useAppTheme();
  const [tab, setTab] = React.useState<"subject" | "recent">("subject");
  const total = errorsBySubject.reduce((sum, item) => sum + item.count, 0);
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Revisão de erros"
        subtitle="Reforce seus pontos fracos"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: theme.dangerSubtle,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <View
            style={[styles.alertIcon, { backgroundColor: theme.dangerSubtle }]}
          >
            <Ionicons name="warning-outline" size={20} color={theme.danger} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              {total} questões para revisar
            </Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              Revisar erros aumenta sua taxa de acerto em até 30%
            </Text>
          </View>
        </View>
        <View
          style={[styles.segment, { backgroundColor: theme.surfaceSubtle }]}
        >
          {[
            ["subject", "Por matéria"],
            ["recent", "Mais recentes"],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setTab(key as "subject" | "recent")}
              style={[
                styles.segmentButton,
                tab === key && { backgroundColor: theme.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: tab === key ? theme.text : theme.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === "subject" ? (
          <View style={styles.list}>
            {errorsBySubject.map((item) => (
              <Pressable
                key={item.subject}
                accessibilityRole="button"
                style={[styles.errorRow, { backgroundColor: theme.surface }]}
              >
                <View
                  style={[
                    styles.errorIcon,
                    { backgroundColor: theme.dangerSubtle },
                  ]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={21}
                    color={theme.danger}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.moduleTitle, { color: theme.text }]}>
                    {item.subject}
                  </Text>
                  <Text style={[styles.caption, { color: theme.textMuted }]}>
                    {item.count} erros · último {item.lastError}
                  </Text>
                </View>
                <Text style={[styles.errorCount, { color: theme.danger }]}>
                  {item.count}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.textMuted}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {recentErrors.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.push(`/questao/${item.id}`)}
                style={[
                  styles.errorQuestion,
                  { backgroundColor: theme.surface },
                ]}
              >
                <View
                  style={[
                    styles.errorIcon,
                    { backgroundColor: theme.dangerSubtle },
                  ]}
                >
                  <Ionicons
                    name="trending-down-outline"
                    size={18}
                    color={theme.danger}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.moduleTitle, { color: theme.text }]}>
                    {item.topic}
                  </Text>
                  <Text style={[styles.caption, { color: theme.textMuted }]}>
                    {item.subject} · {item.banca} · {item.year}
                  </Text>
                  <Text style={[styles.tiny, { color: theme.danger }]}>
                    {item.attempts}x errada · há {item.daysAgo} dias
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.textMuted}
                />
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/questao/1")}
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="refresh" size={17} color={theme.onPrimary} />
          <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
            Revisar todas ({total})
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function RankingScreen() {
  const theme = useAppTheme();
  const [period, setPeriod] = React.useState("Semanal");
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <BackGradientHeader
        title="Ranking"
        subtitle="Compita com outros candidatos"
        icon="trophy"
      />
      <View style={styles.periods}>
        {["Semanal", "Mensal", "Geral"].map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => setPeriod(item)}
            style={[
              styles.period,
              period === item && { backgroundColor: theme.onPrimary },
            ]}
          >
            <Text
              style={{
                color:
                  period === item ? theme.primary : "rgba(255,255,255,0.8)",
                fontSize: typography.size.sm,
                fontWeight: typography.weight.medium,
              }}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: spacing[3] }]}
      >
        <View style={[styles.podium, { backgroundColor: theme.surface }]}>
          {[topUsers[1], topUsers[0], topUsers[2]].map((user, index) => (
            <View
              key={user.rank}
              style={[styles.podiumPerson, index === 1 && { marginTop: -12 }]}
            >
              {index === 1 && (
                <Ionicons name="trophy" size={22} color={theme.warning} />
              )}
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor:
                      index === 1
                        ? theme.primary
                        : index === 2
                          ? theme.warningSubtle
                          : theme.surfaceSubtle,
                    borderColor: index === 1 ? theme.warning : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: index === 1 ? theme.onPrimary : theme.text,
                    fontWeight: typography.weight.bold,
                    fontSize: typography.size.lg,
                  }}
                >
                  {user.avatar}
                </Text>
              </View>
              <Text style={[styles.podiumName, { color: theme.text }]}>
                {user.name}
              </Text>
              <Text style={[styles.tiny, { color: theme.textMuted }]}>
                {user.score} XP
              </Text>
              <View
                style={[
                  styles.podiumBase,
                  {
                    backgroundColor:
                      index === 1
                        ? theme.primary
                        : index === 2
                          ? theme.warningSubtle
                          : theme.surfaceSubtle,
                  },
                ]}
              >
                <Ionicons
                  name={index === 1 ? "trophy" : "medal-outline"}
                  size={index === 1 ? 22 : 18}
                  color={index === 1 ? theme.warning : theme.textMuted}
                />
                <Text
                  style={{
                    color: index === 1 ? theme.onPrimary : theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  {user.rank}º
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.userList, { backgroundColor: theme.surface }]}>
          {otherUsers.map((user) => (
            <View
              key={user.rank}
              style={[styles.userRow, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.rankNumber, { color: theme.textMuted }]}>
                {user.rank}
              </Text>
              <View
                style={[
                  styles.smallAvatar,
                  { backgroundColor: theme.surfaceSubtle },
                ]}
              >
                <Text style={[styles.smallAvatarText, { color: theme.text }]}>
                  {user.avatar}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.moduleTitle, { color: theme.text }]}>
                  {user.name}
                </Text>
                <Text style={[styles.tiny, { color: theme.textMuted }]}>
                  <Ionicons name="flame" size={11} color={theme.warning} />{" "}
                  {user.streak}d
                </Text>
              </View>
              <Text style={[styles.score, { color: theme.primary }]}>
                {user.score.toLocaleString()}
                <Text style={[styles.tiny, { color: theme.textMuted }]}>
                  {" "}
                  XP
                </Text>
              </Text>
            </View>
          ))}
        </View>
        <View
          style={[styles.myPosition, { backgroundColor: theme.primarySubtle }]}
        >
          <Text style={[styles.rankNumber, { color: theme.primary }]}>
            #142
          </Text>
          <View
            style={[styles.smallAvatar, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.smallAvatarText, { color: theme.onPrimary }]}>
              M
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              Sua posição
            </Text>
            <Text style={[styles.tiny, { color: theme.textMuted }]}>
              <Ionicons name="trending-up" size={11} color={theme.success} />{" "}
              +24 posições essa semana
            </Text>
          </View>
          <Text style={[styles.score, { color: theme.primary }]}>1.248</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function PlansScreen() {
  const theme = useAppTheme();
  const { user, systemSettings, refreshProfile } = useAuth();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const [plansData, setPlansData] = React.useState<Plan[]>([]);
  const [testimonials, setTestimonials] = React.useState<HomeTestimonial[]>([]);
  const [billingCycle, setBillingCycle] =
    React.useState<PlanBillingCycle>("monthly");
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [openingCheckoutPlanId, setOpeningCheckoutPlanId] =
    React.useState<number | null>(null);
  const checkoutOpenedRef = React.useRef(false);
  const faqs = [
    "Posso cancelar a qualquer momento?",
    "Como funciona a garantia de 7 dias?",
    "Posso usar em mais de um dispositivo?",
  ];

  React.useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      planService.getPlans(),
      homeTestimonialsService.getApproved(),
    ]).then(([plansResult, testimonialsResult]) => {
      if (!isMounted) return;
      if (plansResult.status === "fulfilled") {
        setPlansData(
          plansResult.value.filter(
            (plan) =>
              plan.is_active !== false &&
              isPlanEnabledByName(plan.name, systemSettings.planDetails),
          ),
        );
      } else {
        setLoadError("Não foi possível carregar os planos agora.");
      }
      if (testimonialsResult.status === "fulfilled")
        setTestimonials(testimonialsResult.value);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [systemSettings.planDetails]);

  const visibleTestimonials = resolveHomeTestimonials(testimonials);
  const visiblePlans = React.useMemo(() => {
    const plansByTier = new Map<string, Plan>();

    plansData
      .filter((plan) => plan.is_test_plan !== true)
      .forEach((plan) => {
        const canonicalName = resolveCanonicalPlanKey(plan.name) || plan.name;
        const isFreePlan =
          canonicalName === "Gratuito" && Number(plan.price || 0) <= 0;
        if (!isFreePlan && !matchesPlanBillingCycle(plan, billingCycle)) return;
        if (!plansByTier.has(canonicalName))
          plansByTier.set(canonicalName, plan);
      });

    return Array.from(plansByTier.entries())
      .sort(([left], [right]) => {
        const order = { Gratuito: 0, Essencial: 1, Pro: 2, Elite: 3 };
        return (
          (order[left as keyof typeof order] ?? 99) -
          (order[right as keyof typeof order] ?? 99)
        );
      })
      .map(([, plan]) => plan);
  }, [billingCycle, plansData]);

  // O destaque comercial "Mais escolhido" deve existir em apenas um card.
  // O plano Pro tem prioridade; se ele não estiver publicado, usamos o
  // primeiro plano pago disponível como fallback.
  const mostChosenPlanId = React.useMemo(() => {
    const pro = visiblePlans.find(
      (plan) => resolveCanonicalPlanKey(plan.name) === "Pro",
    );
    if (pro) return pro.id;

    return visiblePlans.find((plan) => Number(plan.price || 0) > 0)?.id;
  }, [visiblePlans]);

  const openCheckout = async (plan: Plan) => {
    if (openingCheckoutPlanId !== null) return;
    if (!user) {
      Alert.alert("Assinatura", "Entre na sua conta para escolher um plano.");
      return;
    }
    if (Number(plan.price || 0) <= 0) {
      Alert.alert("Plano gratuito", "Este plano não exige checkout.");
      return;
    }

    const missingProfileFields = getMissingCheckoutProfileFields(user);
    if (missingProfileFields.length > 0) {
      router.push({
        pathname: "/perfil/editar",
        params: { checkout: "1" },
      });
      return;
    }

    const startCheckout = async () => {
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

        if (!(await Linking.canOpenURL(checkoutUrl))) {
          throw new Error("Não foi possível abrir o checkout no aparelho.");
        }

        checkoutOpenedRef.current = true;
        await Linking.openURL(checkoutUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/complete seu perfil|confirme o e-mail/i.test(message)) {
          router.push({
            pathname: "/perfil/editar",
            params: { checkout: "1" },
          });
          return;
        }
        const isExpiredSession = /sess[aã]o.*(inv[aá]lida|expirada)/i.test(
          message,
        );
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

    Alert.alert(
      "Continuar para o checkout",
      "Ao continuar, você confirma que leu e aceita os termos de adesão da assinatura.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Continuar", onPress: () => void startCheckout() },
      ],
    );
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
      <BackGradientHeader
        title="Estude sem limites"
        subtitle="Junte-se a mais de 50.000 aprovados"
        icon="sparkles"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.featuresCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            O que você ganha
          </Text>
          <View style={styles.featureGrid}>
            {premiumFeatures.map(([icon, text]) => (
              <View key={text} style={styles.feature}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: theme.primarySubtle },
                  ]}
                >
                  <Ionicons
                    name={iconFor(icon)}
                    size={16}
                    color={theme.primary}
                  />
                </View>
                <Text style={[styles.featureText, { color: theme.text }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <SectionTitle title="Planos disponíveis" theme={theme} />
        <View
          style={[
            styles.billingCycleRow,
            { backgroundColor: theme.surfaceSubtle },
          ]}
        >
          {PLAN_BILLING_CYCLES.map((cycle) => {
            const isSelected = billingCycle === cycle.key;
            return (
              <Pressable
                key={cycle.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setBillingCycle(cycle.key)}
                style={[
                  styles.billingCycleButton,
                  isSelected && {
                    backgroundColor: theme.surface,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.billingCycleLabel,
                    { color: isSelected ? theme.primary : theme.textMuted },
                  ]}
                >
                  {cycle.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
        {!isLoading && !loadError && plansData.length === 0 ? (
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
        <View style={styles.list}>
          {visiblePlans.map((plan) => {
            const canonicalName =
              resolveCanonicalPlanKey(plan.name) || plan.name;
            const cycleCount = getPlanCycleCount(plan);
            const cycleAmount =
              plan.interval_unit === "day" || plan.interval_unit === "week"
                ? Number(plan.price || 0)
                : resolveConfiguredPlanCycleAmount(
                    plan,
                    systemSettings.pricing,
                  );
            const monthlyAmount = cycleAmount / cycleCount;
            const usesMonthlyEquivalent =
              plan.interval_unit === "month" || plan.interval_unit === "year";
            const displayedAmount = usesMonthlyEquivalent
              ? monthlyAmount
              : cycleAmount;
            const displayedUnit = usesMonthlyEquivalent
              ? "/mês"
              : `/${getPlanCycleLabel(plan)}`;
            const isElite = canonicalName === "Elite";
            const isMostChosen = plan.id === mostChosenPlanId;
            const isHighlighted = isMostChosen || isElite;
            const isCurrent =
              String(user?.subscription?.plan_id || "") === String(plan.id);
            const features = Array.isArray(plan.features)
              ? plan.features.filter((feature) => feature.included).slice(0, 3)
              : [];
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                disabled={openingCheckoutPlanId !== null}
                onPress={() => void openCheckout(plan)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor:
                      isElite
                        ? palette.amber[600]
                        : isCurrent || isMostChosen
                          ? theme.primary
                          : theme.border,
                    borderWidth: isHighlighted || isCurrent ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.flex}>
                  {isCurrent ? (
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: theme.success, color: "#FFFFFF" },
                      ]}
                    >
                      Plano atual
                    </Text>
                  ) : isElite ? (
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: palette.amber[600],
                          color: palette.white,
                        },
                      ]}
                    >
                      Máximo acesso
                    </Text>
                  ) : isMostChosen ? (
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: theme.primary,
                          color: theme.onPrimary,
                        },
                      ]}
                    >
                      Mais escolhido
                    </Text>
                  ) : null}
                  <Text style={[styles.planName, { color: theme.text }]}>
                    {resolveConfiguredPlanDisplayName(
                      plan.name,
                      systemSettings.planDetails,
                    )}
                  </Text>
                  <Text style={[styles.caption, { color: theme.textMuted }]}>
                    {plan.description ||
                      `${canonicalName} para sua rotina de estudos`}
                  </Text>
                  <Text style={[styles.tiny, { color: theme.textMuted }]}>
                    {formatPlanAmount(cycleAmount)} por{" "}
                    {getPlanCycleLabel(plan)}
                  </Text>
                  {features.map((feature) => (
                    <Text
                      key={feature.text}
                      style={[styles.planFeature, { color: theme.textMuted }]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={theme.success}
                      />{" "}
                      {feature.text}
                    </Text>
                  ))}
                </View>
                <View style={styles.alignRight}>
                  {openingCheckoutPlanId === plan.id ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : null}
                  <Text style={[styles.planPrice, { color: theme.text }]}>
                    {formatPlanAmount(displayedAmount)}
                  </Text>
                  <Text style={[styles.caption, { color: theme.textMuted }]}>
                    {displayedUnit}
                  </Text>
                  <Text style={[styles.caption, { color: theme.success }]}>
                    {Number(plan.price || 0) === 0
                      ? "Acesso gratuito"
                      : "Assinar agora"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[styles.guarantee, { backgroundColor: theme.primarySubtle }]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={34}
            color={theme.primary}
          />
          <View style={styles.flex}>
            <Text style={[styles.moduleTitle, { color: theme.text }]}>
              Garantia de 7 dias
            </Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              Cancele nos primeiros 7 dias e receba reembolso total. Sem
              perguntas.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.testimonialsCard,
            { backgroundColor: theme.primarySubtle },
          ]}
        >
          <View style={styles.testimonialsHeader}>
            <View style={styles.flex}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Quem usa, aprova
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                Relatos de alunos que estudam com mais direção.
              </Text>
            </View>
            <Ionicons
              name="chatbubbles-outline"
              size={25}
              color={theme.primary}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.testimonialsRow}
          >
            {visibleTestimonials.map((testimonial) => {
              const photoUri = resolveTestimonialPhotoUrl(testimonial.photoUrl);
              return (
                <View
                  key={testimonial.id}
                  style={[
                    styles.testimonialCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.testimonialPerson}>
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.testimonialAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.testimonialAvatarFallback,
                          { backgroundColor: theme.primarySubtle },
                        ]}
                      >
                        <Text
                          style={[
                            styles.testimonialInitials,
                            { color: theme.primary },
                          ]}
                        >
                          {testimonial.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Text
                        numberOfLines={1}
                        style={[styles.testimonialName, { color: theme.text }]}
                      >
                        {testimonial.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[styles.tiny, { color: theme.textMuted }]}
                      >
                        {testimonial.role}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stars}>
                    {Array.from({ length: testimonial.rating }).map(
                      (_, index) => (
                        <Ionicons
                          key={index}
                          name="star"
                          size={13}
                          color={theme.warning}
                        />
                      ),
                    )}
                  </View>
                  <Text style={[styles.testimonialText, { color: theme.text }]}>
                    {testimonial.text}
                  </Text>
                  {testimonial.verified && testimonial.source === "approved" ? (
                    <Text
                      style={[styles.verifiedText, { color: theme.success }]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={theme.success}
                      />{" "}
                      Verificado
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <SectionTitle title="Perguntas frequentes" theme={theme} />
        {faqs.map((question, index) => (
          <Pressable
            key={question}
            accessibilityRole="button"
            onPress={() => setOpenFaq(openFaq === index ? null : index)}
            style={[styles.faq, { backgroundColor: theme.surface }]}
          >
            <View style={styles.rowBetween}>
              <Text
                style={[styles.moduleTitle, { color: theme.text, flex: 1 }]}
              >
                {question}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={17}
                color={theme.textMuted}
                style={
                  openFaq === index
                    ? { transform: [{ rotate: "90deg" }] }
                    : undefined
                }
              />
            </View>
            {openFaq === index && (
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                Sim! Você pode cancelar quando quiser. Consulte os termos da sua
                assinatura para detalhes.
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
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
  planName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  planPrice: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
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
  testimonialsCard: {
    borderRadius: radius.md,
    gap: spacing[3],
    padding: spacing[5],
  },
  testimonialsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
  },
  testimonialsRow: { gap: spacing[3], paddingRight: spacing[4] },
  testimonialCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[4],
    width: 270,
  },
  testimonialPerson: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
  },
  testimonialAvatar: { borderRadius: 24, height: 44, width: 44 },
  testimonialAvatarFallback: {
    alignItems: "center",
    borderRadius: 24,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  testimonialInitials: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  testimonialName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  stars: { flexDirection: "row", gap: 2 },
  testimonialText: { fontSize: typography.size.xs, lineHeight: 19 },
  verifiedText: { fontSize: 10, fontWeight: typography.weight.semibold },
});
