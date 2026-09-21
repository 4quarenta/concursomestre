import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import { StandardSectionHeader } from "@/components/layout/StandardSectionHeader";
import { questionService } from "@/services/questions/questionService";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type QuestionFilterKind = "disciplina" | "assunto" | "banca" | "orgao" | "cargo" | "foco" | "modalidade" | "ano";

const fallback = {
  bancas: ["CESPE", "FCC", "FGV", "VUNESP", "IBFC"],
  anos: ["2024", "2023", "2022", "2021", "2020"],
  materias: ["Português", "Matemática", "Direito Const.", "Informática", "Administração", "Direito Admin.", "Raciocínio Lógico", "Atualidades"],
  assuntos: ["Interpretação de texto", "Constituição Federal", "Atos administrativos", "Regência verbal"],
  cargos: ["Analista", "Técnico", "Auditor", "Professor"],
  orgaos: ["Tribunal de Justiça", "Ministério Público", "Prefeitura Municipal", "Administração Pública Federal"],
  carreiras: ["Carreira fiscal", "Tribunais", "Controle", "Segurança pública"],
};

const difficultyOptions = [
  { key: "easy", label: "Fácil", color: "#16A34A" },
  { key: "medium", label: "Médio", color: "#D97706" },
  { key: "hard", label: "Difícil", color: "#DC2626" },
];

const levelOptions = ["Superior", "Médio", "Fundamental"];

const splitParam = (value?: string | string[]) => {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw.split(",").map((item) => item.trim()).filter((item) => Boolean(item) && item !== "__none__");
};

const FilterRow = ({ label, icon, values, onPress, theme }: { label: string; icon: keyof typeof Ionicons.glyphMap; values: string[]; onPress: () => void; theme: ResolvedAppTheme }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Selecionar ${label}`}
    onPress={onPress}
    style={({ pressed }) => [styles.filterRow, { borderBottomColor: theme.border }, pressed && styles.pressed]}
  >
    <View style={[styles.filterIcon, { backgroundColor: theme.primarySubtle }]}>
      <Ionicons name={icon} size={18} color={theme.primary} />
    </View>
    <View style={styles.filterCopy}>
      <Text style={[styles.filterLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.filterValue, { color: theme.textMuted }]} numberOfLines={1}>{values.length ? values.join(", ") : "Todos"}</Text>
    </View>
    {values.length ? <Text style={[styles.filterCount, { color: theme.primary }]}>{values.length}</Text> : null}
    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
  </Pressable>
);

const ToggleOption = ({ label, icon, active, onPress, theme }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void; theme: ResolvedAppTheme }) => (
  <Pressable
    accessibilityRole="checkbox"
    accessibilityState={{ checked: active }}
    onPress={onPress}
    style={({ pressed }) => [
      styles.toggleOption,
      { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primarySubtle : theme.surface },
      pressed && styles.pressed,
    ]}
  >
    <Ionicons name={icon} size={17} color={active ? theme.primary : theme.textMuted} />
    <Text style={[styles.toggleOptionText, { color: active ? theme.primary : theme.textMuted }]}>{label}</Text>
  </Pressable>
);

export const QuestionFiltersScreen: React.FC = () => {
  const theme = useAppTheme();
  const stylesForTheme = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
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
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    const kind = params.filterType as QuestionFilterKind | undefined;
    if (!kind || params.values === undefined) return;
    const key = `${kind}:${params.values}`;
    if (appliedParam.current === key) return;
    appliedParam.current = key;
    const values = splitParam(params.values);
    if (kind === "disciplina") setSelectedSubjects(values);
    if (kind === "assunto") setSelectedTopics(values);
    if (kind === "banca") setSelectedBancas(values);
    if (kind === "orgao") setSelectedOrganizations(values);
    if (kind === "cargo") setSelectedRoles(values);
    if (kind === "foco") setSelectedCareers(values);
    if (kind === "modalidade") setSelectedModalities(values);
  }, [params.filterType, params.values]);

  const bancas = taxonomiesQuery.data?.bancas?.map((item) => item.nome).filter(Boolean) as string[] || fallback.bancas;
  const years = taxonomiesQuery.data?.anos?.map(String).filter(Boolean) || fallback.anos;
  const subjects = taxonomiesQuery.data?.materias?.map((item) => item.nome).filter(Boolean) as string[] || fallback.materias;
  const topics = taxonomiesQuery.data?.assuntos?.map((item) => item.nome).filter(Boolean) as string[] || fallback.assuntos;
  const roles = taxonomiesQuery.data?.cargos?.map((item) => item.nome).filter(Boolean) as string[] || fallback.cargos;
  const organizations = taxonomiesQuery.data?.orgaos?.map((item) => item.nome).filter(Boolean) as string[] || fallback.orgaos;
  const careers = taxonomiesQuery.data?.carreiras?.map((item) => item.nome).filter(Boolean) as string[] || fallback.carreiras;
  const totalFilters = selectedBancas.length + selectedYears.length + selectedSubjects.length + selectedTopics.length + selectedRoles.length + selectedOrganizations.length + selectedCareers.length + selectedLevels.length + selectedModalities.length + selectedDifficulties.length + (keyword.trim() ? 1 : 0) + (onlySaved ? 1 : 0) + (hasTeacherComment ? 1 : 0) + (hasDetailedComment ? 1 : 0) + (excludeCanceled ? 1 : 0) + (excludeOutdated ? 1 : 0) + (excludeAnswered ? 1 : 0);

  const toggle = (list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const clearAll = () => {
    setKeyword(""); setSelectedBancas([]); setSelectedYears([]); setSelectedSubjects([]); setSelectedTopics([]); setSelectedRoles([]); setSelectedOrganizations([]); setSelectedCareers([]); setSelectedLevels([]); setSelectedModalities([]); setSelectedDifficulties([]); setOnlySaved(false); setHasTeacherComment(false); setHasDetailedComment(false); setExcludeCanceled(false); setExcludeOutdated(false); setExcludeAnswered(false);
  };

  const openPicker = (type: QuestionFilterKind, values: string[]) => {
    router.push({ pathname: "/questoes/filtro/[type]", params: { type, values: values.join(",") } });
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const difficultyValues = selectedDifficulties.map((value) => value === "easy" ? "Facil" : value === "medium" ? "Medio" : "Dificil");
      const result = await questionService.getQuestionPage({
        keyword: keyword.trim() || undefined,
        agency: selectedBancas.length ? selectedBancas : undefined,
        year: selectedYears.length ? selectedYears : undefined,
        subject: selectedSubjects.length ? selectedSubjects : undefined,
        topic: selectedTopics.length ? selectedTopics : undefined,
        organization: selectedOrganizations.length ? selectedOrganizations : undefined,
        role: selectedRoles.length ? selectedRoles : undefined,
        career: selectedCareers.length ? selectedCareers : undefined,
        level: selectedLevels.length ? selectedLevels : undefined,
        modality: selectedModalities.length ? selectedModalities : undefined,
        difficulty: difficultyValues.length ? difficultyValues : undefined,
        onlySaved: onlySaved || undefined,
        hasTeacherComment: hasTeacherComment || undefined,
        hasDetailedComment: hasDetailedComment || undefined,
        excludeCanceled: excludeCanceled || undefined,
        excludeOutdated: excludeOutdated || undefined,
        excludeAnswered: excludeAnswered || undefined,
        limit: 1,
        page: 1,
      });
      const firstQuestion = result.rows.find((question) => question.id !== undefined && question.id !== null);
      if (!firstQuestion?.id) {
        Alert.alert("Nenhuma questão encontrada", "Ajuste os filtros e tente novamente.");
        return;
      }
      router.replace({
        pathname: "/questao/[id]",
        params: { id: String(firstQuestion.id), flow: "1", palavraChave: keyword.trim(), bancas: selectedBancas.join(","), anos: selectedYears.join(","), materias: selectedSubjects.join(","), assuntos: selectedTopics.join(","), orgaos: selectedOrganizations.join(","), cargos: selectedRoles.join(","), focos: selectedCareers.join(","), niveis: selectedLevels.join(","), modalidades: selectedModalities.join(","), dificuldades: selectedDifficulties.join(","), apenasSalvas: onlySaved ? "1" : "", comentarioProfessor: hasTeacherComment ? "1" : "", analiseDetalhada: hasDetailedComment ? "1" : "", excluirAnuladas: excludeCanceled ? "1" : "", excluirDesatualizadas: excludeOutdated ? "1" : "", naoRespondidas: excludeAnswered ? "1" : "" },
      });
    } catch (error: any) {
      Alert.alert("Não foi possível iniciar", error?.message || "Tente novamente em alguns instantes.");
    } finally {
      setStarting(false);
    }
  };

  const ChipList = ({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) => (
    <View style={stylesForTheme.chips}>
      {options.map((option) => (
        <Pressable key={option} accessibilityRole="button" onPress={() => onToggle(option)} style={({ pressed }) => [stylesForTheme.chip, { borderColor: theme.border, backgroundColor: theme.surface }, selected.includes(option) && stylesForTheme.chipActive, pressed && styles.pressed]}>
          <Text style={[stylesForTheme.chipText, { color: theme.text }, selected.includes(option) && stylesForTheme.chipTextActive]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={stylesForTheme.screen}>
      <ScrollView contentContainerStyle={[stylesForTheme.body, { paddingBottom: 76 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <StandardSectionHeader
          title="Questões"
          subtitle="Monte seu treino personalizado"
        />

        <View style={stylesForTheme.content}>
          <Pressable accessibilityRole="button" onPress={() => void start()} style={({ pressed }) => [stylesForTheme.quickStart, pressed && styles.pressed]}>
            <View style={[stylesForTheme.quickStartIcon, { backgroundColor: theme.primarySubtle }]}><Ionicons name="sparkles-outline" size={24} color={theme.primary} /></View>
            <View style={stylesForTheme.quickCopy}><Text style={[stylesForTheme.quickTitle, { color: theme.text }]}>Início rápido</Text><Text style={[stylesForTheme.quickDescription, { color: theme.textMuted }]}>Questões aleatórias de todas as matérias</Text></View>
            <Ionicons name="arrow-forward" size={20} color={theme.textMuted} />
          </Pressable>

          <View style={stylesForTheme.divider}><View style={[stylesForTheme.dividerLine, { backgroundColor: theme.border }]} /><Text style={[stylesForTheme.dividerText, { color: theme.textMuted }]}>ou personalize</Text><View style={[stylesForTheme.dividerLine, { backgroundColor: theme.border }]} /></View>

          <View style={[stylesForTheme.keywordField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              accessibilityLabel="Pesquisar por palavra-chave"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setKeyword}
              placeholder="Pesquisar no enunciado ou pelo ID"
              placeholderTextColor={theme.textSubtle}
              style={[stylesForTheme.keywordInput, { color: theme.text }]}
              value={keyword}
            />
          </View>

          <View style={[stylesForTheme.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <FilterRow label="Foco" icon="flag-outline" values={selectedCareers} theme={theme} onPress={() => openPicker("foco", selectedCareers)} />
            <FilterRow label="Disciplina" icon="book-outline" values={selectedSubjects} theme={theme} onPress={() => openPicker("disciplina", selectedSubjects)} />
            <FilterRow label="Assunto" icon="list-outline" values={selectedTopics} theme={theme} onPress={() => openPicker("assunto", selectedTopics)} />
            <FilterRow label="Banca" icon="business-outline" values={selectedBancas} theme={theme} onPress={() => openPicker("banca", selectedBancas)} />
            <FilterRow label="Órgão" icon="business-outline" values={selectedOrganizations} theme={theme} onPress={() => openPicker("orgao", selectedOrganizations)} />
            <FilterRow label="Cargo" icon="briefcase-outline" values={selectedRoles} theme={theme} onPress={() => openPicker("cargo", selectedRoles)} />
            <FilterRow label="Modalidade" icon="help-circle-outline" values={selectedModalities} theme={theme} onPress={() => openPicker("modalidade", selectedModalities)} />
          </View>

          <View style={stylesForTheme.sectionHeader}><Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Anos</Text><Pressable onPress={() => setSelectedYears([])}><Text style={[stylesForTheme.clearText, { color: theme.primary }]}>Limpar</Text></Pressable></View>
          <ChipList options={years} selected={selectedYears} onToggle={(value) => toggle(selectedYears, setSelectedYears, value)} />

          <View style={stylesForTheme.sectionHeader}><Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Dificuldade</Text></View>
          <View style={stylesForTheme.optionRow}>{difficultyOptions.map((option) => <Pressable key={option.key} onPress={() => toggle(selectedDifficulties, setSelectedDifficulties, option.key)} style={[stylesForTheme.difficultyButton, { borderColor: selectedDifficulties.includes(option.key) ? option.color : theme.border, backgroundColor: selectedDifficulties.includes(option.key) ? `${option.color}15` : theme.surface }]}><Text style={[stylesForTheme.optionText, { color: selectedDifficulties.includes(option.key) ? option.color : theme.textMuted }]}>{option.label}</Text></Pressable>)}</View>

          <View style={stylesForTheme.sectionHeader}><Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Nível</Text><Pressable onPress={() => setSelectedLevels([])}><Text style={[stylesForTheme.clearText, { color: theme.primary }]}>Limpar</Text></Pressable></View>
          <ChipList options={levelOptions} selected={selectedLevels} onToggle={(value) => toggle(selectedLevels, setSelectedLevels, value)} />

          <View style={stylesForTheme.sectionHeader}><Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Excluir questões</Text><Pressable onPress={() => { setExcludeCanceled(false); setExcludeOutdated(false); setExcludeAnswered(false); }}><Text style={[stylesForTheme.clearText, { color: theme.primary }]}>Limpar</Text></Pressable></View>
          <View style={stylesForTheme.optionGrid}>
            <ToggleOption label="Anuladas" icon="close-circle-outline" active={excludeCanceled} onPress={() => setExcludeCanceled((value) => !value)} theme={theme} />
            <ToggleOption label="Desatualizadas" icon="alert-circle-outline" active={excludeOutdated} onPress={() => setExcludeOutdated((value) => !value)} theme={theme} />
            <ToggleOption label="Resolvidas" icon="checkmark-circle-outline" active={excludeAnswered} onPress={() => setExcludeAnswered((value) => !value)} theme={theme} />
          </View>

          <View style={stylesForTheme.sectionHeader}><Text style={[stylesForTheme.sectionTitle, { color: theme.text }]}>Apenas questões com</Text><Pressable onPress={() => { setOnlySaved(false); setHasTeacherComment(false); setHasDetailedComment(false); }}><Text style={[stylesForTheme.clearText, { color: theme.primary }]}>Limpar</Text></Pressable></View>
          <View style={stylesForTheme.optionGrid}>
            <ToggleOption label="Salvas" icon="bookmark-outline" active={onlySaved} onPress={() => setOnlySaved((value) => !value)} theme={theme} />
            <ToggleOption label="Comentário do professor" icon="school-outline" active={hasTeacherComment} onPress={() => setHasTeacherComment((value) => !value)} theme={theme} />
            <ToggleOption label="Análise detalhada" icon="sparkles-outline" active={hasDetailedComment} onPress={() => setHasDetailedComment((value) => !value)} theme={theme} />
          </View>
        </View>
      </ScrollView>

      <View style={[stylesForTheme.ctaBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: spacing[2] }]}>
        {totalFilters > 0 ? <Pressable accessibilityRole="button" onPress={clearAll} style={[stylesForTheme.clearButton, { borderColor: theme.border }]}><Ionicons name="refresh-outline" size={18} color={theme.text} /></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={starting} onPress={() => void start()} style={[stylesForTheme.startButton, { backgroundColor: theme.primary }, starting && stylesForTheme.startButtonDisabled]}>{starting ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Ionicons name="filter-outline" size={17} color={theme.onPrimary} />}<Text style={[stylesForTheme.startText, { color: theme.onPrimary }]}>{starting ? "Abrindo primeira questão..." : totalFilters ? `Aplicar filtros (${totalFilters})` : "Filtrar"}</Text></Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filterRow: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing[3], minHeight: 72, paddingHorizontal: spacing[4] },
  filterIcon: { alignItems: "center", borderRadius: radius.md, height: 38, justifyContent: "center", width: 38 },
  filterCopy: { flex: 1, gap: 2 },
  filterLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  filterValue: { fontSize: typography.size.xs },
  filterCount: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  toggleOption: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flexGrow: 1, flexDirection: "row", gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3] },
  toggleOptionText: { flexShrink: 1, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  pressed: { opacity: 0.74 },
});

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  body: { paddingBottom: spacing[8] },
  content: { gap: spacing[4], paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  quickStart: { alignItems: "center", backgroundColor: theme.surface, borderRadius: radius.lg, elevation: 3, flexDirection: "row", gap: spacing[4], marginTop: -spacing[4], padding: spacing[5], shadowColor: theme.text, shadowOpacity: 0.08, shadowRadius: 8, zIndex: 2 },
  quickStartIcon: { alignItems: "center", borderRadius: radius.md, height: 48, justifyContent: "center", width: 48 },
  quickCopy: { flex: 1, gap: 2 },
  quickTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  quickDescription: { fontSize: typography.size.xs },
  divider: { alignItems: "center", flexDirection: "row", gap: spacing[3], paddingVertical: spacing[1] },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: typography.weight.medium, letterSpacing: 1, textTransform: "uppercase" },
  keywordField: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 48, paddingHorizontal: spacing[3] },
  keywordInput: { flex: 1, fontSize: typography.size.sm, minHeight: 46, paddingVertical: 0 },
  filterCard: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: spacing[2] },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
  clearText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipActive: { borderColor: theme.primary, backgroundColor: theme.primarySubtle },
  chipText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },
  chipTextActive: { color: theme.primary, fontWeight: typography.weight.bold },
  optionRow: { flexDirection: "row", gap: spacing[2] },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  optionButton: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[2] },
  difficultyButton: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 44 },
  optionText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  ctaBar: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  clearButton: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  startButton: { alignItems: "center", borderRadius: radius.md, flex: 1, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3] },
  startButtonDisabled: { opacity: 0.7 },
  startText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});

export default QuestionFiltersScreen;
