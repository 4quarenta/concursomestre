import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PreferenceKey =
  "daily" | "streak" | "achievements" | "promos" | "email" | "push";

type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  theme: ResolvedAppTheme;
};

function Toggle({ value, onChange, theme }: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={value ? "Ativado" : "Desativado"}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={[
        styles.toggle,
        { backgroundColor: value ? theme.primary : theme.surfaceSubtle },
      ]}
    >
      <View
        style={[
          styles.toggleThumb,
          { backgroundColor: theme.surface },
          value && styles.toggleThumbActive,
        ]}
      />
    </Pressable>
  );
}

const typeItems: Array<{
  key: Exclude<PreferenceKey, "email" | "push">;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}> = [
  {
    key: "daily",
    icon: "time-outline",
    label: "Lembrete diário",
    description: "Aviso para estudar todos os dias",
  },
  {
    key: "streak",
    icon: "flame-outline",
    label: "Streak em risco",
    description: "Avise quando seu streak estiver perto de quebrar",
  },
  {
    key: "achievements",
    icon: "trophy-outline",
    label: "Novas conquistas",
    description: "Quando desbloquear medalhas",
  },
  {
    key: "promos",
    icon: "megaphone-outline",
    label: "Novidades e ofertas",
    description: "Conteúdos novos e promoções",
  },
];

const channelItems: Array<{
  key: "push" | "email";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}> = [
  {
    key: "push",
    icon: "notifications-outline",
    label: "Notificações push",
    description: "Diretamente no seu dispositivo",
  },
  {
    key: "email",
    icon: "mail-outline",
    label: "Email",
    description: "Receba resumos por email",
  },
];

const initialPreferences: Record<PreferenceKey, boolean> = {
  daily: true,
  streak: true,
  achievements: true,
  promos: false,
  email: true,
  push: true,
};

export function NotificationSettingsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] =
    React.useState<Record<PreferenceKey, boolean>>(initialPreferences);
  const [time, setTime] = React.useState("19:00");

  const setPreference = (key: PreferenceKey, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const normalizeTime = (value: string) => {
    const cleaned = value.replace(/[^0-9:]/g, "").slice(0, 5);
    if (cleaned.length === 2 && !cleaned.includes(":")) {
      setTime(`${cleaned}:`);
      return;
    }
    setTime(cleaned);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Notificações" subtitle="Personalize seus alertas" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[12] + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            TIPOS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, shadowColor: theme.text },
            ]}
          >
            {typeItems.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.preferenceRow,
                  index > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.preferenceIcon,
                    { backgroundColor: theme.surfaceSubtle },
                  ]}
                >
                  <Ionicons name={item.icon} size={16} color={theme.text} />
                </View>
                <View style={styles.preferenceCopy}>
                  <Text style={[styles.preferenceLabel, { color: theme.text }]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.preferenceDescription,
                      { color: theme.textMuted },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
                <Toggle
                  theme={theme}
                  value={preferences[item.key]}
                  onChange={(value) => setPreference(item.key, value)}
                />
              </View>
            ))}
          </View>
        </View>

        {preferences.daily && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
              HORÁRIO DO LEMBRETE
            </Text>
            <View
              style={[
                styles.card,
                styles.timeCard,
                { backgroundColor: theme.surface, shadowColor: theme.text },
              ]}
            >
              <Ionicons name="time-outline" size={17} color={theme.textMuted} />
              <TextInput
                accessibilityLabel="Horário do lembrete"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={normalizeTime}
                placeholder="19:00"
                placeholderTextColor={theme.textMuted}
                style={[styles.timeInput, { color: theme.text }]}
                value={time}
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            CANAIS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, shadowColor: theme.text },
            ]}
          >
            {channelItems.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.preferenceRow,
                  index > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.preferenceIcon,
                    { backgroundColor: theme.surfaceSubtle },
                  ]}
                >
                  <Ionicons name={item.icon} size={16} color={theme.text} />
                </View>
                <View style={styles.preferenceCopy}>
                  <Text style={[styles.preferenceLabel, { color: theme.text }]}>
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.preferenceDescription,
                      { color: theme.textMuted },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
                <Toggle
                  theme={theme}
                  value={preferences[item.key]}
                  onChange={(value) => setPreference(item.key, value)}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: spacing[6],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    paddingBottom: spacing[12],
  },
  section: { gap: spacing[2] },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1,
    paddingHorizontal: spacing[1],
  },
  card: {
    borderRadius: radius.md,
    elevation: 2,
    overflow: "hidden",
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 72,
    padding: spacing[4],
  },
  preferenceIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  preferenceCopy: { flex: 1, gap: 2, minWidth: 0 },
  preferenceLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  preferenceDescription: { fontSize: typography.size.xs },
  toggle: {
    borderRadius: radius.pill,
    height: 24,
    justifyContent: "center",
    padding: 2,
    width: 44,
  },
  toggleThumb: {
    borderRadius: radius.pill,
    elevation: 1,
    height: 20,
    width: 20,
  },
  toggleThumbActive: { alignSelf: "flex-end" },
  timeCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  timeInput: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    padding: 0,
  },
});
