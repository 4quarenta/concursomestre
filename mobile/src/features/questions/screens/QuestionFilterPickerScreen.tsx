import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import type { QuestionTaxonomyOption } from "@/features/questions/api/taxonomyService";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { QuestionFilterKind } from "@/features/questions/screens/QuestionFiltersScreen";

const configs: Record<QuestionFilterKind, { label: string; icon: keyof typeof Ionicons.glyphMap; key?: "materias" | "assuntos" | "bancas" | "orgaos" | "cargos" | "carreiras" | "anos" }> = {
  disciplina: { label: "Disciplina", icon: "book-outline", key: "materias" },
  assunto: { label: "Assunto", icon: "list-outline", key: "assuntos" },
  banca: { label: "Banca", icon: "business-outline", key: "bancas" },
  orgao: { label: "Órgão", icon: "business-outline", key: "orgaos" },
  cargo: { label: "Cargo", icon: "briefcase-outline", key: "cargos" },
  foco: { label: "Foco", icon: "flag-outline", key: "carreiras" },
  modalidade: { label: "Modalidade", icon: "help-circle-outline" },
  ano: { label: "Ano", icon: "calendar-outline", key: "anos" },
};

const fallback: Record<QuestionFilterKind, string[]> = {
  disciplina: ["Português", "Matemática", "Direito Const.", "Informática", "Administração", "Direito Admin.", "Raciocínio Lógico", "Atualidades"],
  assunto: ["Interpretação de texto", "Constituição Federal", "Atos administrativos", "Regência verbal"],
  banca: ["CESPE", "FCC", "FGV", "VUNESP", "IBFC"],
  orgao: ["Tribunal de Justiça", "Ministério Público", "Prefeitura Municipal", "Administração Pública Federal"],
  cargo: ["Analista", "Técnico", "Auditor", "Professor"],
  foco: ["Carreira fiscal", "Tribunais", "Controle", "Segurança pública"],
  modalidade: ["Múltipla escolha", "Certo/Errado"],
  ano: ["2024", "2023", "2022", "2021", "2020"],
};

const splitParam = (value?: string | string[]) => {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw.split(",").map((item) => item.trim()).filter((item) => Boolean(item) && item !== "__none__");
};

export default function QuestionFilterPickerScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; values?: string; returnTo?: string }>();
  const type = (params.type as QuestionFilterKind) in configs ? params.type as QuestionFilterKind : "disciplina";
  const config = configs[type];
  const taxonomiesQuery = useQuestionTaxonomiesQuery();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(() => splitParam(params.values));

  const options = React.useMemo(() => {
    const remote = config.key ? taxonomiesQuery.data?.[config.key] as QuestionTaxonomyOption[] | string[] | undefined : undefined;
    if (remote?.length) return remote.map((item) => typeof item === "string" ? item : item.nome).filter(Boolean);
    return fallback[type];
  }, [config.key, taxonomiesQuery.data, type]);

  const filteredOptions = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return needle ? options.filter((item) => item.toLocaleLowerCase("pt-BR").includes(needle)) : options;
  }, [options, search]);

  const toggle = (value: string) => {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const apply = () => {
    const destination = params.returnTo || "/questoes";
    router.replace({ pathname: destination as "/questoes", params: { filterType: type, values: selected.join(",") || "__none__" } });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={23} color={theme.onPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <View style={styles.headerTitleRow}><Ionicons name={config.icon} size={18} color={theme.onPrimary} /><Text style={[styles.headerTitle, { color: theme.onPrimary }]}>Escolher {config.label.toLowerCase()}</Text></View>
          <Text style={[styles.headerSubtitle, { color: theme.onPrimary }]}>Selecione uma ou mais opções</Text>
        </View>
      </View>

      <View style={styles.body}>
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setSearch} placeholder={`Buscar ${config.label.toLowerCase()}`} placeholderTextColor={theme.textSubtle} style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} value={search} />
        <View style={styles.selectionHeader}><Text style={[styles.resultLabel, { color: theme.textMuted }]}>{selected.length ? `${selected.length} selecionado(s)` : "Nenhum selecionado"}</Text><Pressable onPress={() => setSelected([])}><Text style={[styles.clearText, { color: theme.primary }]}>Limpar</Text></Pressable></View>
        {taxonomiesQuery.isLoading ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}
        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.textMuted }]}>Nenhuma opção encontrada.</Text>}
          renderItem={({ item }) => {
            const active = selected.includes(item);
            return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(item)} style={({ pressed }) => [styles.option, { backgroundColor: theme.surface, borderColor: active ? theme.primary : theme.border }, active && { backgroundColor: theme.primarySubtle }, pressed && styles.pressed]}><View style={styles.optionCopy}><Text style={[styles.optionText, { color: theme.text }]}>{item}</Text></View><View style={[styles.checkbox, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.surface }]}>{active ? <Ionicons name="checkmark" size={16} color={theme.onPrimary} /> : null}</View></Pressable>;
          }}
        />
      </View>

      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(spacing[2], insets.bottom) }]}>
        <Pressable accessibilityRole="button" onPress={apply} style={[styles.applyButton, { backgroundColor: theme.primary }]}><Text style={[styles.applyText, { color: theme.onPrimary }]}>Aplicar{selected.length ? ` (${selected.length})` : ""}</Text></Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  headerCopy: { flex: 1, gap: 2 },
  headerTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  headerSubtitle: { fontSize: typography.size.xs, opacity: 0.82 },
  body: { flex: 1, padding: spacing[4] },
  search: { borderRadius: radius.md, borderWidth: 1, minHeight: 48, paddingHorizontal: spacing[3] },
  selectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing[3] },
  resultLabel: { fontSize: typography.size.xs },
  clearText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  loader: { marginVertical: spacing[4] },
  list: { gap: spacing[2], paddingBottom: spacing[4] },
  option: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flexDirection: "row", minHeight: 56, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  optionCopy: { flex: 1 },
  optionText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  checkbox: { alignItems: "center", borderRadius: radius.sm, borderWidth: 1, height: 24, justifyContent: "center", width: 24 },
  empty: { paddingVertical: spacing[8], textAlign: "center" },
  footer: { borderTopWidth: 1, paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  applyButton: { alignItems: "center", borderRadius: radius.md, justifyContent: "center", minHeight: 48 },
  applyText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  pressed: { opacity: 0.74 },
});
