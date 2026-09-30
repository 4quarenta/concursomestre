import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppButton, MotionPressable } from "@/components/ui/Primitives";
import { router, useLocalSearchParams } from "expo-router";
import { QuestionFilterChip, QuestionFilterRow, QuestionFilterToggle } from "@/components/questions/QuestionFilterPrimitives";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import { questionService } from "@/services/questions/questionService";
import {
  saveLastQuestionFilter,
  toQuestionListFilters,
  toQuestionRouteParams,
  type QuestionFilterSelection,
} from "@/services/questions/lastQuestionFilterService";
import { layout, palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

export type QuestionFilterKind = "disciplina" | "assunto" | "banca" | "orgao" | "cargo" | "foco" | "modalidade" | "ano";

const difficultyOptions = [
  { key: "easy", label: "Fácil" },
  { key: "medium", label: "Médio" },
  { key: "hard", label: "Difícil" },
];
const levelOptions = ["Superior", "Médio", "Fundamental"];

const splitParam = (value?: string | string[]) =>
  (Array.isArray(value) ? value.join(",") : value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && item !== "__none__");

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderBottomColor: theme.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 68,
    justifyContent: "center",
  },
  backButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    left: spacing[3],
    position: "absolute",
    width: 48,
    zIndex: 1,
  },
  headerCopy: { alignItems: "center", gap: 2 },
  headerTitle: { color: theme.text, ...typography.role.screenTitle },
  headerSubtitle: { color: theme.textMuted, ...typography.role.screenDescription },
  scroll: { flex: 1 },
  content: { gap: spacing[4], paddingBottom: spacing[5], paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  sectionTitle: { color: theme.text, ...typography.role.sectionTitle },
  clearAll: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  search: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 52,
    paddingHorizontal: spacing[3],
  },
  searchInput: { color: theme.text, flex: 1, ...typography.role.body, minHeight: 50, paddingVertical: 0 },
  filterCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  group: { gap: spacing[3] },
  groupHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  groupTitle: { color: theme.text, ...typography.role.sectionTitle },
  clearText: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  yearChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  yearChip: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexBasis: "22%", flexGrow: 1, justifyContent: "center", minHeight: 42 },
  yearChipActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  yearChipText: { color: theme.textMuted, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  yearChipTextActive: { color: theme.primary, fontWeight: typography.weight.bold },
  allYearsButton: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: spacing[1] },
  allYearsText: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  quickFilters: { flexDirection: "column", gap: spacing[2] },
  quickFilter: { width: "100%" },
  moreButton: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 76,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  moreIcon: { alignItems: "center", height: 44, justifyContent: "center", width: 30 },
  moreCopy: { flex: 1, gap: spacing[1] },
  moreTitle: { color: theme.text, ...typography.role.sectionTitle },
  moreDescription: { color: theme.textMuted, ...typography.role.body },
  moreCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing[5],
    padding: spacing[4],
  },
  errorNotice: {
    alignItems: "center",
    backgroundColor: theme.dangerSubtle,
    borderColor: theme.dangerBorder,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[3],
  },
  errorText: { color: theme.danger, flex: 1, fontSize: typography.size.xs },
  retryText: { color: theme.danger, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  footer: {
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  footerButton: {
    alignItems: "center",
    borderRadius: radius.button,
    flex: 1,
    justifyContent: "center",
    minHeight: layout.buttonHeight,
  },
  clearButton: { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
  clearButtonText: { color: theme.text, fontSize: typography.role.button.fontSize, lineHeight: typography.role.button.lineHeight, fontWeight: typography.weight.semibold },
  filterButton: { backgroundColor: theme.primary, borderColor: theme.primary },
  primaryButtonText: { color: theme.onPrimary, fontSize: typography.role.button.fontSize, lineHeight: typography.role.button.lineHeight, fontWeight: typography.role.button.fontWeight },
  pressed: { opacity: 0.94 },
  disabled: { opacity: 0.65 },
});

export const QuestionFiltersScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const taxonomiesQuery = useQuestionTaxonomiesQuery();
  const params = useLocalSearchParams<{ filterType?: string; values?: string }>();
  const appliedParam = React.useRef("");
  const [selectedBancas, setSelectedBancas] = React.useState<string[]>([]);
  const [selectedYears, setSelectedYears] = React.useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = React.useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = React.useState<string[]>([]);
  const [selectedCareers, setSelectedCareers] = React.useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = React.useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = React.useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = React.useState<string[]>([]);
  const [keyword, setKeyword] = React.useState("");
  const [onlySaved, setOnlySaved] = React.useState(false);
  const [hasTeacherComment, setHasTeacherComment] = React.useState(false);
  const [hasDetailedComment, setHasDetailedComment] = React.useState(false);
  const [excludeCanceled, setExcludeCanceled] = React.useState(false);
  const [excludeOutdated, setExcludeOutdated] = React.useState(false);
  const [excludeAnswered, setExcludeAnswered] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    const kind = params.filterType as QuestionFilterKind | undefined;
    if (!kind || params.values === undefined) return;
    const key = `${kind}:${params.values}`;
    if (appliedParam.current === key) return;
    appliedParam.current = key;
    const values = splitParam(params.values);
    if (kind === "disciplina") {
      setSelectedSubjects(values);
      if (values.length === 0) setSelectedTopics([]);
    }
    if (kind === "assunto") setSelectedTopics(values);
    if (kind === "banca") setSelectedBancas(values);
    if (kind === "orgao") setSelectedOrganizations(values);
    if (kind === "cargo") setSelectedRoles(values);
    if (kind === "foco") setSelectedCareers(values);
    if (kind === "modalidade") setSelectedModalities(values);
    if (kind === "ano") setSelectedYears(values);
  }, [params.filterType, params.values]);

  const taxonomies = taxonomiesQuery.data;
  const years = React.useMemo(
    () => [...(taxonomies?.anos || [])].sort((left, right) => Number(right) - Number(left)),
    [taxonomies?.anos],
  );

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) =>
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const clearAll = () => {
    setKeyword("");
    setSelectedBancas([]);
    setSelectedYears([]);
    setSelectedSubjects([]);
    setSelectedTopics([]);
    setSelectedRoles([]);
    setSelectedOrganizations([]);
    setSelectedCareers([]);
    setSelectedLevels([]);
    setSelectedModalities([]);
    setSelectedDifficulties([]);
    setOnlySaved(false);
    setHasTeacherComment(false);
    setHasDetailedComment(false);
    setExcludeCanceled(false);
    setExcludeOutdated(false);
    setExcludeAnswered(false);
  };
  const openPicker = (type: QuestionFilterKind, values: string[]) =>
    router.push({ pathname: "/questoes/filtro/[type]", params: { type, values: values.join(",") } });

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const selection: QuestionFilterSelection = {
        palavraChave: keyword,
        bancas: selectedBancas,
        anos: selectedYears,
        materias: selectedSubjects,
        assuntos: selectedTopics,
        orgaos: selectedOrganizations,
        cargos: selectedRoles,
        focos: selectedCareers,
        niveis: selectedLevels,
        modalidades: selectedModalities,
        dificuldades: selectedDifficulties,
        apenasSalvas: onlySaved,
        comentarioProfessor: hasTeacherComment,
        analiseDetalhada: hasDetailedComment,
        excluirAnuladas: excludeCanceled,
        excluirDesatualizadas: excludeOutdated,
        naoRespondidas: excludeAnswered,
      };
      const result = await questionService.getQuestionPage({
        ...toQuestionListFilters(selection),
        page: 1,
        limit: 1,
      });
      const firstQuestion = result.rows.find((question) => question.id !== undefined && question.id !== null);
      if (!firstQuestion?.id) {
        Alert.alert("Nenhuma questão encontrada", "Ajuste os filtros e tente novamente.");
        return;
      }
      // Persistimos somente quando o filtro foi aplicado com sucesso. Uma falha
      // local de armazenamento não deve impedir o início da sessão de questões.
      await saveLastQuestionFilter(selection).catch(() => undefined);
      router.push({
        pathname: "/questao/[id]",
        params: toQuestionRouteParams(selection, firstQuestion.id),
      });
    } catch (error: any) {
      Alert.alert("Não foi possível iniciar", error?.message || "Tente novamente em alguns instantes.");
    } finally {
      setStarting(false);
    }
  };

  const footerBottomPadding = spacing[2];

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" />
      <View style={styles.header}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/inicio")}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </MotionPressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Novo filtro</Text>
          <Text style={styles.headerSubtitle}>Questões</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Escolher filtros</Text>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Limpar todos os filtros"
            onPress={clearAll}
            style={({ pressed }) => [styles.clearAll, pressed && styles.pressed]}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.textMuted} />
          </MotionPressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} />
          <TextInput
            accessibilityLabel="Pesquisar por enunciado ou palavra-chave"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setKeyword}
            placeholder="Palavra-chave ou enunciado"
            placeholderTextColor={theme.textSubtle}
            returnKeyType="search"
            style={styles.searchInput}
            value={keyword}
          />
        </View>

        <View style={styles.filterCard}>
          <QuestionFilterRow label="Disciplina" icon="book-outline" values={selectedSubjects} onPress={() => openPicker("disciplina", selectedSubjects)} theme={theme} />
          <QuestionFilterRow label="Assunto" icon="list-outline" values={selectedTopics} onPress={() => openPicker("assunto", selectedTopics)} theme={theme} disabled={selectedSubjects.length === 0} disabledValue="Escolha disciplina" />
          <QuestionFilterRow label="Banca" icon="business-outline" values={selectedBancas} onPress={() => openPicker("banca", selectedBancas)} theme={theme} />
          <QuestionFilterRow label="Cargo" icon="briefcase-outline" values={selectedRoles} onPress={() => openPicker("cargo", selectedRoles)} theme={theme} />
        </View>

        <View style={styles.group}>
          <View style={styles.groupHeading}>
            <Text style={styles.groupTitle}>Anos</Text>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Limpar anos selecionados" onPress={() => setSelectedYears([])}>
              <Text style={styles.clearText}>Limpar</Text>
            </MotionPressable>
          </View>
          {taxonomiesQuery.isLoading && years.length === 0 ? (
            <ActivityIndicator color={theme.primary} style={{ alignSelf: "flex-start" }} />
          ) : years.length > 0 ? (
            <>
              <View style={styles.yearChips}>
                {years.slice(0, 12).map((year) => {
                  const active = selectedYears.includes(year);
                  return (
                    <MotionPressable
                      key={year}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      onPress={() => toggle(setSelectedYears, year)}
                      style={({ pressed }) => [styles.yearChip, active && styles.yearChipActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>{year}</Text>
                    </MotionPressable>
                  );
                })}
              </View>
              {years.length > 12 ? (
                <MotionPressable accessibilityRole="button" onPress={() => openPicker("ano", selectedYears)} style={styles.allYearsButton}>
                  <Text style={styles.allYearsText}>Ver todos os anos</Text>
                </MotionPressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.headerSubtitle}>Anos não disponíveis no momento.</Text>
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Apenas questões com</Text>
          <View style={styles.quickFilters}>
            <View style={styles.quickFilter}>
              <QuestionFilterToggle
                label="Comentário do professor"
                active={hasTeacherComment}
                onPress={() => setHasTeacherComment((value) => !value)}
                theme={theme}
              />
            </View>
            <View style={styles.quickFilter}>
              <QuestionFilterToggle
                label="Análise detalhada"
                active={hasDetailedComment}
                onPress={() => setHasDetailedComment((value) => !value)}
                theme={theme}
              />
            </View>
            <View style={styles.quickFilter}>
              <QuestionFilterToggle
                label="Salvas"
                active={onlySaved}
                onPress={() => setOnlySaved((value) => !value)}
                theme={theme}
              />
            </View>
          </View>
        </View>

        <MotionPressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          onPress={() => setMoreOpen((value) => !value)}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
        >
          <View style={styles.moreIcon}>
            <Ionicons name="options-outline" size={22} color={theme.text} />
          </View>
          <View style={styles.moreCopy}>
            <Text style={styles.moreTitle}>{moreOpen ? "Menos filtros" : "Mais filtros"}</Text>
            {!moreOpen ? <Text style={styles.moreDescription}>Nível, dificuldade, foco, modalidade, órgão/entidade e exclusão de questões</Text> : null}
          </View>
          <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={19} color={theme.textMuted} />
        </MotionPressable>

        {moreOpen ? (
          <View style={styles.moreCard}>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Contexto</Text>
              <QuestionFilterRow label="Órgão" icon="business-outline" values={selectedOrganizations} onPress={() => openPicker("orgao", selectedOrganizations)} theme={theme} />
              <QuestionFilterRow label="Foco" icon="flag-outline" values={selectedCareers} onPress={() => openPicker("foco", selectedCareers)} theme={theme} />
              <QuestionFilterRow label="Modalidade" icon="help-circle-outline" values={selectedModalities} onPress={() => openPicker("modalidade", selectedModalities)} theme={theme} />
            </View>

            <FilterGroup
              title="Nível"
              options={levelOptions}
              selected={selectedLevels}
              onToggle={(value) => toggle(setSelectedLevels, value)}
              onClear={() => setSelectedLevels([])}
              theme={theme}
            />
            <FilterGroup
              title="Dificuldade"
              options={difficultyOptions.map((item) => item.key)}
              labels={difficultyOptions.map((item) => item.label)}
              selected={selectedDifficulties}
              onToggle={(value) => toggle(setSelectedDifficulties, value)}
              onClear={() => setSelectedDifficulties([])}
              theme={theme}
            />
            <View style={styles.group}>
              <View style={styles.groupHeading}>
                <Text style={styles.groupTitle}>Excluir questões</Text>
                <MotionPressable onPress={() => { setExcludeCanceled(false); setExcludeOutdated(false); setExcludeAnswered(false); }}>
                  <Text style={styles.clearText}>Limpar</Text>
                </MotionPressable>
              </View>
              <View style={styles.quickFilters}>
                <View style={styles.quickFilter}>
                  <QuestionFilterToggle label="Anuladas" active={excludeCanceled} onPress={() => setExcludeCanceled((value) => !value)} theme={theme} />
                </View>
                <View style={styles.quickFilter}>
                  <QuestionFilterToggle label="Desatualizadas" active={excludeOutdated} onPress={() => setExcludeOutdated((value) => !value)} theme={theme} />
                </View>
                <View style={styles.quickFilter}>
                  <QuestionFilterToggle label="Resolvidas" active={excludeAnswered} onPress={() => setExcludeAnswered((value) => !value)} theme={theme} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {taxonomiesQuery.isError ? (
          <View style={styles.errorNotice}>
            <Ionicons name="cloud-offline-outline" size={18} color={theme.danger} />
            <Text style={styles.errorText}>Não foi possível carregar as opções de filtro.</Text>
            <MotionPressable onPress={() => void taxonomiesQuery.refetch()}>
              <Text style={styles.retryText}>Tentar</Text>
            </MotionPressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
        <AppButton label="Limpar filtro" variant="secondary" disabled={starting} onPress={clearAll} style={styles.footerButton} />
        <AppButton label="Filtrar" loading={starting} disabled={starting} onPress={() => void start()} style={[styles.footerButton, styles.filterButton]} />
      </View>
    </View>
  );
};

type FilterGroupProps = {
  title: string;
  options: string[];
  labels?: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  theme: ResolvedAppTheme;
};

const FilterGroup: React.FC<FilterGroupProps> = ({ title, options, labels, selected, onToggle, onClear, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <Text style={styles.groupTitle}>{title}</Text>
        <MotionPressable onPress={onClear}>
          <Text style={styles.clearText}>Limpar</Text>
        </MotionPressable>
      </View>
      <View style={styles.chips}>
        {options.map((option, index) => (
          <QuestionFilterChip
            key={option}
            active={selected.includes(option)}
            label={labels?.[index] || option}
            onPress={() => onToggle(option)}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
};

export default QuestionFiltersScreen;
