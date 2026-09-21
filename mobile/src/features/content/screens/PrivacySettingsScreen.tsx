import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

type PrivacyKey = "profilePublic" | "showRanking" | "usageData";
type PrivacyState = Record<PrivacyKey, boolean>;

const STORAGE_KEY = "concursomestre.privacy";
const initialState: PrivacyState = {
  profilePublic: false,
  showRanking: true,
  usageData: false,
};

const items: Array<{
  key: PrivacyKey;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}> = [
  {
    key: "profilePublic",
    icon: "person-outline",
    label: "Perfil público",
    description: "Permitir que outros alunos vejam seu perfil",
  },
  {
    key: "showRanking",
    icon: "podium-outline",
    label: "Mostrar no ranking",
    description: "Exibir seu nome e desempenho nos rankings",
  },
  {
    key: "usageData",
    icon: "analytics-outline",
    label: "Dados de uso",
    description: "Permitir dados anônimos para melhorar o app",
  },
];

function Toggle({ value, onChange, theme }: { value: boolean; onChange: () => void; theme: ResolvedAppTheme }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={value ? "Ativado" : "Desativado"}
      hitSlop={8}
      onPress={onChange}
      style={[styles.toggle, { backgroundColor: value ? theme.primary : theme.surfaceSubtle }]}
    >
      <View style={[styles.toggleThumb, { backgroundColor: theme.surface }, value && styles.toggleThumbActive]} />
    </Pressable>
  );
}

export function PrivacySettingsScreen() {
  const theme = useAppTheme();
  const [preferences, setPreferences] = React.useState<PrivacyState>(initialState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted || !value) return;
        try {
          const saved = JSON.parse(value) as Partial<PrivacyState>;
          setPreferences((current) => ({ ...current, ...saved }));
        } catch {
          // Invalid local preferences remain on the safe defaults.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(
      () => undefined,
    );
  }, [hydrated, preferences]);

  const toggle = (key: PrivacyKey) =>
    setPreferences((current) => ({ ...current, [key]: !current[key] }));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Privacidade" subtitle="Dados e segurança" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>VISIBILIDADE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {items.slice(0, 2).map((item, index) => (
              <PrivacyRow
                key={item.key}
                item={item}
                value={preferences[item.key]}
                onToggle={() => toggle(item.key)}
                theme={theme}
                first={index === 0}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DADOS</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <PrivacyRow
              item={items[2]}
              value={preferences.usageData}
              onToggle={() => toggle("usageData")}
              theme={theme}
              first
            />
          </View>
        </View>

        <Text style={[styles.helper, { color: theme.textMuted }]}>
          Estas preferências são salvas neste aparelho. O app não compartilha seus dados pessoais sem sua autorização.
        </Text>
      </ScrollView>
    </View>
  );
}

function PrivacyRow({
  item,
  value,
  onToggle,
  theme,
  first,
}: {
  item: (typeof items)[number];
  value: boolean;
  onToggle: () => void;
  theme: ResolvedAppTheme;
  first: boolean;
}) {
  return (
    <View style={[styles.preferenceRow, !first && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
        <Ionicons name={item.icon} size={17} color={theme.text} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{item.label}</Text>
        <Text style={[styles.rowDescription, { color: theme.textMuted }]}>{item.description}</Text>
      </View>
      <Toggle value={value} onChange={onToggle} theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing[6], paddingHorizontal: spacing[5], paddingVertical: spacing[5], paddingBottom: spacing[12] },
  section: { gap: spacing[2] },
  sectionLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, letterSpacing: 1, paddingHorizontal: spacing[1] },
  card: { borderRadius: radius.lg, elevation: 2, overflow: "hidden", shadowOpacity: 0.06, shadowRadius: 5 },
  preferenceRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 76, padding: spacing[4] },
  iconBox: { alignItems: "center", borderRadius: radius.md, height: 40, justifyContent: "center", width: 40 },
  copy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  rowDescription: { fontSize: typography.size.xs, lineHeight: 17 },
  toggle: { borderRadius: radius.pill, height: 28, justifyContent: "center", padding: 3, width: 48 },
  toggleThumb: { borderRadius: radius.pill, height: 22, width: 22 },
  toggleThumbActive: { alignSelf: "flex-end" },
  helper: { fontSize: typography.size.xs, lineHeight: 18, textAlign: "center" },
});
