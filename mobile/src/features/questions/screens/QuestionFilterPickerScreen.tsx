import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotionPressable } from "@/components/ui/Primitives";
import { useQuestionTaxonomiesQuery } from "@/features/questions/api/useQuestionTaxonomiesQuery";
import type { QuestionTaxonomyOption } from "@/features/questions/api/taxonomyService";
import type { QuestionFilterKind } from "@/features/questions/screens/QuestionFiltersScreen";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

const configs: Record<QuestionFilterKind, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  key?: "materias" | "assuntos" | "bancas" | "orgaos" | "cargos" | "carreiras" | "anos";
}> = {
  disciplina: { label: "Disciplina", icon: "book-outline", key: "materias" },
  assunto: { label: "Assunto", icon: "list-outline", key: "assuntos" },
  banca: { label: "Banca", icon: "business-outline", key: "bancas" },
  orgao: { label: "Órgão", icon: "business-outline", key: "orgaos" },
  cargo: { label: "Cargo", icon: "briefcase-outline", key: "cargos" },
  foco: { label: "Foco", icon: "flag-outline", key: "carreiras" },
  modalidade: { label: "Modalidade", icon: "help-circle-outline" },
  ano: { label: "Ano", icon: "calendar-outline", key: "anos" },
};

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
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 72,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 32 },
  headerCopy: { flex: 1, gap: spacing[1] },
  headerTitle: { color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  headerSubtitle: { color: theme.textMuted, fontSize: typography.size.sm },
  headerIcon: { marginRight: spacing[1] },
  body: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  search: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.borderStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 54,
    paddingHorizontal: spacing[3],
  },
  searchInput: { color: theme.text, flex: 1, fontSize: typography.size.sm, minHeight: 52, paddingVertical: 0 },
  selectionBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 54 },
  selectionText: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  selectionAction: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  optionsList: { flex: 1 },
  optionsCardContent: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  option: { alignItems: "center", flexDirection: "row", minHeight: 61, paddingHorizontal: spacing[4] },
  optionDivider: { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { color: theme.text, flex: 1, fontSize: typography.size.sm },
  optionCheck: {
    alignItems: "center",
    borderColor: theme.textMuted,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  optionCheckActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  empty: { color: theme.textMuted, padding: spacing[6], textAlign: "center" },
  loading: { padding: spacing[5] },
  errorBox: { alignItems: "center", gap: spacing[2], padding: spacing[5] },
  error: { color: theme.danger, fontSize: typography.size.sm, textAlign: "center" },
  retry: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold, padding: spacing[2] },
  footer: {
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  applyButton: { alignItems: "center", backgroundColor: theme.primary, borderRadius: radius.button, justifyContent: "center", minHeight: 52 },
  applyText: { color: theme.onPrimary, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  pressed: { opacity: 0.94 },
});

export default function QuestionFilterPickerScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; values?: string; returnTo?: string }>();
  const type = params.type && params.type in configs ? params.type as QuestionFilterKind : "disciplina";
  const config = configs[type];
  const taxonomiesQuery = useQuestionTaxonomiesQuery();
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(() => splitParam(params.values));
  const remote = config.key ? taxonomiesQuery.data?.[config.key] : undefined;
  const options = React.useMemo(() => {
    if (type === "modalidade") return ["Múltipla escolha", "Certo/Errado"];
    if (!remote) return [];
    const names = (remote as QuestionTaxonomyOption[] | string[])
      .map((item) => typeof item === "string" ? item : item.nome)
      .filter(Boolean);
    return [...new Set(names)];
  }, [remote, type]);
  const filteredOptions = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return needle ? options.filter((item) => item.toLocaleLowerCase("pt-BR").includes(needle)) : options;
  }, [options, search]);
  const bottomInset = Math.max(insets.bottom, spacing[2]);

  const toggle = (value: string) => {
    setSelected((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };
  const apply = () => {
    const destination = params.returnTo || "/questoes";
    router.replace({
      pathname: destination as "/questoes",
      params: { filterType: type, values: selected.join(",") || "__none__" },
    });
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={palette.brand.navy} barStyle="light-content" />
      <View style={styles.header}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={25} color={theme.textMuted} />
        </MotionPressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Escolher {config.label.toLowerCase()}</Text>
          <Text style={styles.headerSubtitle}>Selecione uma ou mais opções</Text>
        </View>
        <Ionicons name={config.icon} size={27} color={theme.primary} style={styles.headerIcon} />
      </View>

      <View style={styles.body}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={23} color={theme.textMuted} />
          <TextInput
            accessibilityLabel={`Buscar ${config.label.toLowerCase()}`}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder={`Buscar ${config.label.toLowerCase()}`}
            placeholderTextColor={theme.textSubtle}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
        </View>

        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {selected.length ? `${selected.length} selecionada${selected.length === 1 ? "" : "s"}` : "Nenhuma selecionada"}
          </Text>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Limpar seleção"
            disabled={selected.length === 0}
            onPress={() => setSelected([])}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.selectionAction}>Limpar</Text>
          </MotionPressable>
        </View>

        {config.key && taxonomiesQuery.isLoading ? <ActivityIndicator color={theme.primary} style={styles.loading} /> : null}
        {config.key && taxonomiesQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>Não foi possível carregar esta lista.</Text>
            <MotionPressable accessibilityRole="button" onPress={() => void taxonomiesQuery.refetch()}>
              <Text style={styles.retry}>Tentar novamente</Text>
            </MotionPressable>
          </View>
        ) : (
          <FlatList
            data={filteredOptions}
            contentContainerStyle={styles.optionsCardContent}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={!taxonomiesQuery.isLoading ? <Text style={styles.empty}>Nenhuma opção encontrada.</Text> : null}
            renderItem={({ item, index }) => {
              const active = selected.includes(item);
              return (
                <MotionPressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  onPress={() => toggle(item)}
                  style={({ pressed }) => [
                    styles.option,
                    index < filteredOptions.length - 1 && styles.optionDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.optionText}>{item}</Text>
                  <View style={[styles.optionCheck, active && styles.optionCheckActive]}>
                    {active ? <Ionicons name="checkmark" size={17} color={theme.onPrimary} /> : null}
                  </View>
                </MotionPressable>
              );
            }}
            style={styles.optionsList}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset }]}>
        <MotionPressable accessibilityRole="button" onPress={apply} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
          <Text style={styles.applyText}>Aplicar{selected.length ? ` (${selected.length})` : ""}</Text>
        </MotionPressable>
      </View>
    </View>
  );
}
