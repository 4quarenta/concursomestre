import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppButton, MotionPressable } from "@/components/ui/Primitives";
import { GuestAccessSheet } from "@/components/GuestAccessSheet";
import { useForm } from "react-hook-form";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { SimulationSubpageHeader } from "@/features/simulations/components/SimulationSubpageHeader";
import { buildSimulationSeed } from "@/features/simulations/api/simulationQuestionPool";
import { simulationConfigSchema, type SimulationConfigFormValues } from "@/features/simulations/schemas/simulationConfigSchema";
import { useSimulationRunStore } from "@/state/simulationRunStore";
import { darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50];
const TIME_OPTIONS = [
  { label: "Sem limite", value: 0 },
  { label: "1 min/questão", value: 1 },
  { label: "2 min/questão", value: 2 },
  { label: "3 min/questão", value: 3 },
];
const DIFFICULTY_OPTIONS = [
  { value: "all" as const, label: "Todas" },
  { value: "easy" as const, label: "Fácil" },
  { value: "medium" as const, label: "Média" },
  { value: "hard" as const, label: "Difícil" },
];

type SectionProps = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; children: React.ReactNode };

type SimulationFilterType = "banca" | "ano" | "disciplina" | "assunto" | "orgao" | "cargo";

const splitParam = (value?: string | string[]) => {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw.split(",").map((item) => item.trim()).filter((item) => Boolean(item) && item !== "__none__");
};

const Section: React.FC<SectionProps> = ({ icon, title, subtitle, children }) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}><Ionicons name={icon} size={16} color={theme.primary} /></View>
        <View style={styles.sectionCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.helper}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
};

type SimulationFilterRowProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  values: string[];
  onPress: () => void;
};

const SimulationFilterRow: React.FC<SimulationFilterRowProps> = ({ label, icon, values, onPress }) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`Selecionar ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.filterRow, pressed && styles.pressed]}
    >
      <View style={styles.filterRowIcon}><Ionicons name={icon} size={17} color={theme.primary} /></View>
      <View style={styles.filterRowCopy}>
        <Text style={styles.filterRowLabel}>{label}</Text>
        <Text numberOfLines={1} style={[styles.filterRowValue, values.length === 0 && styles.filterRowPlaceholder]}>
          {values.length ? values.join(", ") : "Todos"}
        </Text>
      </View>
      {values.length ? <Text style={styles.filterRowCount}>{values.length}</Text> : null}
      <Ionicons name="chevron-forward" size={19} color={theme.textMuted} />
    </MotionPressable>
  );
};

export const SimulationConfigScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const isVisitor = isGuest || !user?.id;
  const params = useLocalSearchParams<{ filterType?: string; values?: string }>();
  const appliedParam = React.useRef("");
  const setSeed = useSimulationRunStore((state) => state.setSeed);
  const [starting, setStarting] = React.useState(false);
  const [guestAccessVisible, setGuestAccessVisible] = React.useState(false);
  const [timePerQuestion, setTimePerQuestion] = React.useState(2);

  const { watch, setValue, handleSubmit } = useForm<SimulationConfigFormValues>({
    defaultValues: {
      questionCount: 20,
      timerEnabled: true,
      timerMinutes: 40,
      keyword: "",
      difficulty: "all",
      feedbackMode: "after_all",
      randomOrder: true,
      subjects: [],
      agencies: [],
      years: [],
      organizations: [],
      roles: [],
      topics: [],
    },
  });
  const values = watch();

  React.useEffect(() => {
    const type = params.filterType as SimulationFilterType | undefined;
    if (!type || params.values === undefined) return;
    const key = `${type}:${params.values}`;
    if (appliedParam.current === key) return;
    appliedParam.current = key;
    const next = splitParam(params.values);
    if (type === "banca") setValue("agencies", next);
    if (type === "ano") setValue("years", next);
    if (type === "disciplina") setValue("subjects", next);
    if (type === "assunto") setValue("topics", next);
    if (type === "orgao") setValue("organizations", next);
    if (type === "cargo") setValue("roles", next);
  }, [params.filterType, params.values, setValue]);

  React.useEffect(() => {
    setValue("timerEnabled", timePerQuestion > 0);
    setValue("timerMinutes", timePerQuestion > 0 ? Math.min(300, values.questionCount * timePerQuestion) : 1);
  }, [setValue, timePerQuestion, values.questionCount]);

  const selectedFilters = values.subjects.length + values.agencies.length + values.years.length + values.topics.length + values.organizations.length + values.roles.length + (values.difficulty !== "all" ? 1 : 0);

  const start = handleSubmit(async (formValues) => {
    if (isVisitor) {
      setGuestAccessVisible(true);
      return;
    }
    const parsed = simulationConfigSchema.safeParse(formValues);
    if (!parsed.success) {
      Alert.alert("Configuração inválida", parsed.error.issues[0]?.message || "Revise os dados do simulado.");
      return;
    }
    setStarting(true);
    try {
      const seed = await buildSimulationSeed({ ...parsed.data, keyword: parsed.data.keyword?.trim() || undefined });
      setSeed({ ...seed, id: `sim-mobile-${seed.startedAt}-${Math.random().toString(36).slice(2, 8)}` });
      router.replace("/simulados/executar");
    } catch (error: any) {
      Alert.alert("Simulado", error?.message || "Não foi possível montar o simulado.");
    } finally {
      setStarting(false);
    }
  });

  const openPicker = (type: SimulationFilterType, selected: string[]) => {
    router.push({
      pathname: "/simulados/filtro/[type]",
      params: {
        type,
        values: selected.join(","),
        returnTo: "/simulados/novo",
      },
    });
  };

  return (
    <View style={styles.screen}>
      <SimulationSubpageHeader title="Novo simulado" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 116 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>Monte a prova do seu jeito</Text>
          <Text style={styles.introDescription}>
            Escolha filtros e personalize seu simulado.
          </Text>
        </View>

        <Section icon="options-outline" title="Filtros da prova" subtitle="Selecione os critérios para encontrar questões">
          <View style={styles.filterList}>
            <SimulationFilterRow label="Banca" icon="business-outline" values={values.agencies} onPress={() => openPicker("banca", values.agencies)} />
            <SimulationFilterRow label="Ano" icon="calendar-outline" values={values.years} onPress={() => openPicker("ano", values.years)} />
            <SimulationFilterRow label="Matérias" icon="book-outline" values={values.subjects} onPress={() => openPicker("disciplina", values.subjects)} />
            <SimulationFilterRow label="Assuntos" icon="list-outline" values={values.topics} onPress={() => openPicker("assunto", values.topics)} />
            <SimulationFilterRow label="Órgãos" icon="business-outline" values={values.organizations} onPress={() => openPicker("orgao", values.organizations)} />
            <SimulationFilterRow label="Cargos" icon="briefcase-outline" values={values.roles} onPress={() => openPicker("cargo", values.roles)} />
          </View>
        </Section>

        <Section icon="list-outline" title="Quantidade de questões">
          <View style={styles.optionGridFive}>
            {QUESTION_COUNT_OPTIONS.map((option) => {
              const active = values.questionCount === option;
              return (
                <MotionPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setValue("questionCount", option)}
                  style={[styles.countOption, active && styles.gridOptionActive]}
                >
                  <Text style={[styles.countText, active && styles.gridOptionTextActive]}>
                    {option}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        </Section>

        <Section icon="bar-chart-outline" title="Dificuldade">
          <View style={styles.optionGridFour}>
            {DIFFICULTY_OPTIONS.map((option) => {
              const active = values.difficulty === option.value;
              return (
                <MotionPressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setValue("difficulty", option.value)}
                  style={[styles.gridOption, active && styles.gridOptionActive]}
                >
                  <Text style={[styles.gridOptionText, active && styles.gridOptionTextActive]}>
                    {option.label}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        </Section>

        <Section icon="timer-outline" title="Tempo de prova">
          <View style={styles.optionGridTime}>
            {TIME_OPTIONS.map((option) => {
              const active = timePerQuestion === option.value;
              return (
                <MotionPressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTimePerQuestion(option.value)}
                  style={[styles.timeOption, active && styles.gridOptionActive]}
                >
                  <Text style={[styles.gridOptionText, active && styles.gridOptionTextActive]}>
                    {option.label}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        </Section>

        <MotionPressable
          accessibilityRole="switch"
          accessibilityState={{ checked: values.randomOrder }}
          onPress={() => setValue("randomOrder", !values.randomOrder)}
          style={styles.randomCard}
        >
          <View style={styles.sectionIcon}>
            <Ionicons name="shuffle-outline" size={18} color={theme.primary} />
          </View>
          <View style={styles.randomCopy}>
            <Text style={styles.cardTitle}>Ordem aleatória</Text>
            <Text style={styles.helper}>Embaralhar questões e alternativas</Text>
          </View>
          <View style={[styles.toggle, values.randomOrder && styles.toggleActive]}>
            <View style={[styles.toggleKnob, values.randomOrder && styles.toggleKnobActive]} />
          </View>
        </MotionPressable>

        <View style={styles.summary}>
          <Text style={styles.summaryEyebrow}>Resumo do simulado</Text>
          <Text style={styles.summaryText}>
            <Text style={styles.summaryStrong}>{values.questionCount} questões</Text>
            {" · "}{selectedFilters} filtro{selectedFilters === 1 ? "" : "s"}
            {" · "}{values.difficulty === "all" ? "Todas as dificuldades" : DIFFICULTY_OPTIONS.find((item) => item.value === values.difficulty)?.label}
            {timePerQuestion > 0 ? ` · ~${values.questionCount * timePerQuestion} min` : " · Sem limite"}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing[3]) + spacing[2] }]}>
        <AppButton label="Iniciar simulado" loading={starting} disabled={starting} onPress={() => void start()} leading={!starting ? <Ionicons name="play-outline" size={18} color={theme.onPrimary} /> : undefined} style={styles.startButton} />
      </View>
      <GuestAccessSheet
        visible={guestAccessVisible}
        description="Entre ou crie sua conta para iniciar o simulado e salvar seu resultado."
        onDismiss={() => setGuestAccessVisible(false)}
      />
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[3], padding: spacing[4] },
  intro: { gap: spacing[1], paddingBottom: spacing[1] },
  title: { color: theme.text, fontSize: typography.role.sectionTitle.fontSize, lineHeight: typography.role.sectionTitle.lineHeight, fontWeight: typography.role.sectionTitle.fontWeight },
  introDescription: { color: theme.textMuted, fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[3],
    ...(theme === darkTheme ? shadows.cardDark : {}),
  },
  sectionHeading: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  sectionIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.md, height: 36, justifyContent: "center", width: 36 },
  sectionCopy: { flex: 1, gap: spacing[1] },
  cardTitle: { color: theme.text, fontSize: typography.role.sectionTitle.fontSize, lineHeight: typography.role.sectionTitle.lineHeight, fontWeight: typography.role.sectionTitle.fontWeight },
  helper: { color: theme.textMuted, fontSize: typography.role.caption.fontSize, lineHeight: typography.role.caption.lineHeight },
  filterList: { borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  filterRow: { alignItems: "center", backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing[3], minHeight: 58, paddingHorizontal: spacing[3] },
  filterRowIcon: { alignItems: "center", backgroundColor: theme.surfaceSubtle, borderRadius: radius.sm, height: 32, justifyContent: "center", width: 32 },
  filterRowCopy: { flex: 1, gap: 2 },
  filterRowLabel: { color: theme.text, fontSize: typography.role.bodyStrong.fontSize, lineHeight: typography.role.bodyStrong.lineHeight, fontWeight: typography.role.bodyStrong.fontWeight },
  filterRowValue: { color: theme.textMuted, fontSize: typography.role.caption.fontSize, lineHeight: typography.role.caption.lineHeight },
  filterRowPlaceholder: { color: theme.textSubtle },
  filterRowCount: { color: theme.textMuted, fontSize: typography.size.xs },
  optionGridFour: { flexDirection: "row", gap: spacing[1] },
  optionGridFive: { flexDirection: "row", gap: spacing[2] },
  optionGridTime: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  gridOption: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: "center", minWidth: 60, paddingHorizontal: spacing[1] },
  gridOptionActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  gridOptionText: { color: theme.textMuted, fontSize: typography.role.label.fontSize, lineHeight: typography.role.label.lineHeight, fontWeight: typography.role.label.fontWeight, textAlign: "center" },
  gridOptionTextActive: { color: theme.primary, fontWeight: typography.weight.bold },
  countOption: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flex: 1, height: 42, justifyContent: "center" },
  countText: { color: theme.textMuted, fontSize: typography.role.bodyStrong.fontSize, lineHeight: typography.role.bodyStrong.lineHeight, fontWeight: typography.role.bodyStrong.fontWeight },
  timeOption: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexBasis: "48%", flexGrow: 1, minHeight: 42, justifyContent: "center", paddingHorizontal: spacing[2] },
  randomCard: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[3] },
  randomCopy: { flex: 1, gap: spacing[1] },
  toggle: { backgroundColor: theme.borderStrong, borderRadius: radius.pill, height: 26, justifyContent: "center", padding: 3, width: 48 },
  toggleActive: { backgroundColor: theme.primary },
  toggleKnob: { backgroundColor: theme.surface, borderRadius: radius.pill, height: 20, width: 20 },
  toggleKnobActive: { alignSelf: "flex-end" },
  summary: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder, borderRadius: radius.lg, borderWidth: 1, padding: spacing[4] },
  summaryEyebrow: { color: theme.primary, fontSize: typography.role.label.fontSize, lineHeight: typography.role.label.lineHeight, fontWeight: typography.role.label.fontWeight, letterSpacing: 0.7, marginBottom: spacing[1], textTransform: "uppercase" },
  summaryText: { color: theme.text, fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight },
  summaryStrong: { fontWeight: typography.weight.bold },
  ctaBar: { backgroundColor: theme.surface, borderTopColor: theme.border, borderTopWidth: 1, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  startButton: { minHeight: 52 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.94 },
});

export default SimulationConfigScreen;
